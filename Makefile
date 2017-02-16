CC=gcc
CFLAGS=-O3 -g
INCLUDES=-Iretroarch/libretro-common/include

OBJS=ranetplayer.o net_compat.o net_socket.o

ranetplayer: $(OBJS)
	$(CC) $(CFLAGS) $(INCLUDES) $(OBJS) -o $@

%.o: %.c
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

net_%.o: retroarch/libretro-common/net/net_%.c
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

clean:
	rm -f $(OBJS) ranetplayer
