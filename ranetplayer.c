/*
 * Copyright (c) 2017 Gregor Richards
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <sys/types.h>

#include "net/net_socket.h"
#include "retroarch/network/netplay/netplay_private.h"

#define MAX_PAYLOAD 1024

#define ERROR() do { \
   fprintf(stderr, "Netplay disconnected.\n"); \
   exit(1); \
} while(0)

#define RECV() do { \
   if (!socket_receive_all_blocking(sock, &cmd, sizeof(uint32_t)) || \
       !socket_receive_all_blocking(sock, &cmd_size, sizeof(uint32_t))) \
      ERROR(); \
   cmd = ntohl(cmd); \
   cmd_size = ntohl(cmd_size); \
   while (cmd_size > MAX_PAYLOAD*sizeof(uint32_t)) \
   { \
      if (!socket_receive_all_blocking(sock, payload, MAX_PAYLOAD*sizeof(uint32_t))) \
         ERROR(); \
      cmd_size -= MAX_PAYLOAD*sizeof(uint32_t); \
   } \
   if (!socket_receive_all_blocking(sock, payload, cmd_size)) \
      ERROR(); \
} while(0)

#define SEND() do { \
   uint32_t adj_cmd, adj_cmd_size; \
   adj_cmd = htonl(cmd); \
   adj_cmd_size = htonl(cmd_size); \
   if (!socket_send_all_blocking(sock, &adj_cmd, sizeof(uint32_t), true) || \
       !socket_send_all_blocking(sock, &adj_cmd_size, sizeof(uint32_t), true) || \
       !socket_send_all_blocking(sock, payload, cmd_size, true)) \
      ERROR(); \
} while(0)

static int sock, ranp;
static uint32_t cmd, cmd_size, *payload;
static uint32_t frame_offset = 0;

/* Send a bit of our input */
bool send_input(uint32_t cur_frame)
{
   while (1)
   {
      uint32_t rd_frame = 0;

      if (read(ranp, &cmd, sizeof(uint32_t)) != sizeof(uint32_t) ||
          read(ranp, &cmd_size, sizeof(uint32_t)) != sizeof(uint32_t))
         return false;

      cmd = ntohl(cmd);
      cmd_size = ntohl(cmd_size);
      if (cmd_size > MAX_PAYLOAD*sizeof(uint32_t))
      {
         fprintf(stderr, "Input payload too large!\n");
         exit(1);
      }

      if (read(ranp, payload, cmd_size) != cmd_size)
         return false;

      /* Adjust the frame for commands we know */
      switch (cmd)
      {
         case NETPLAY_CMD_INPUT:
         case NETPLAY_CMD_RESET:
         {
            rd_frame = ntohl(payload[0]);
            payload[0] = htonl(rd_frame + frame_offset);
            break;
         }
      }

      SEND();

      if (rd_frame > cur_frame)
         break;
   }

   return true;
}

int main(int argc, char **argv)
{
   struct addrinfo *addr;
   uint32_t rd_frame = 0;

   payload = malloc(MAX_PAYLOAD * sizeof(uint32_t));
   if (!payload)
   {
      perror("malloc");
      return 1;
   }

   ranp = open(argv[3], O_RDONLY);
   if (ranp == -1)
   {
      perror(argv[3]);
      return 1;
   }

   if ((sock = socket_init((void **) &addr, atoi(argv[2]), argv[1], SOCKET_PROTOCOL_TCP)) < 0)
   {
      perror("socket");
      return 1;
   }

   if (socket_connect(sock, addr, false) < 0)
   {
      perror("connect");
      return 1;
   }

   /* Expect the header */
   if (!socket_receive_all_blocking(sock, payload, 4*sizeof(uint32_t)))
   {
      fprintf(stderr, "Failed to receive connection header.\n");
      return 1;
   }

   /* If it needs a password, too bad! */
   if (payload[3])
   {
      fprintf(stderr, "Password required but unsupported.\n");
      return 1;
   }

   /* Echo the connection header back */
   socket_send_all_blocking(sock, payload, 4*sizeof(uint32_t), true);

   /* Send a nickname */
   cmd = NETPLAY_CMD_NICK;
   cmd_size = 32;
   strcpy((char *) payload, "RANetplayer");
   SEND();

   /* Receive (and ignore) the nickname */
   RECV();

   /* Receive INFO */
   RECV();
   if (cmd != NETPLAY_CMD_INFO)
   {
      fprintf(stderr, "Failed to receive INFO.");
      return 1;
   }

   /* Echo the INFO */
   SEND();

   /* Receive (and ignore) SYNC */
   RECV();

   /* Request to enter PLAY mode */
   cmd = NETPLAY_CMD_PLAY;
   cmd_size = 0;
   SEND();

   /* Now play */
   while (1)
   {
      RECV();

      switch (cmd)
      {
         case NETPLAY_CMD_MODE:
         {
            uint32_t player;

            if (cmd_size < 2*sizeof(uint32_t)) break;

            /* See if this is us joining */
            player = ntohl(payload[1]);
            if ((player & NETPLAY_CMD_MODE_BIT_PLAYING) &&
                (player & NETPLAY_CMD_MODE_BIT_YOU))
            {
               /* This is where we start! */
               frame_offset = ntohl(payload[0]);

               /* Then send our current input */
               send_input(0);
            }

            break;
         }

         case NETPLAY_CMD_INPUT:
         case NETPLAY_CMD_NOINPUT:
            if (cmd_size < sizeof(uint32_t)) break;

            payload[0] = ntohl(payload[0]);

            if (frame_offset && payload[0] > rd_frame)
            {
               rd_frame = payload[0];
               if (!send_input(rd_frame - frame_offset + 5))
                  socket_close(sock);
            }

            break;
      }
   }
}
