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

// Only the commands we're interested in are here
var commands = {
   "INPUT": 0x03,
   "NOINPUT": 0x04,
   "INFO": 0x22,
   "MODE": 0x26,
   "CRC": 0x40,
   "LOAD_SAVESTATE": 0x42,
   "RESET": 0x46,
   "FLIP_PLAYERS": 0x60
};
exports.commands = commands;

// Conversion from input names to numeric format
var inputs = {
   "B": 0,
   "Y": 1,
   "s": 2,
   "S": 3,
   "u": 4,
   "d": 5,
   "l": 6,
   "r": 7,
   "A": 8,
   "X": 9,
   "L": 10,
   "R": 11
};
exports.inputs = inputs;

/*
 * RANP is just raw RetroArch Netplay, but we also use an internal (JSONable)
 * format called RANPJ. RANPJ is an array of commands, each of which looks like
 * this:
 *
 * {
 *    "cmd": (command),
 *    "payload": (data payload),
 *    "payloadB": (extra payload bytes)
 * }
 *
 * The command may be a number or a string. The payload may be an array of
 * numbers, a single number (which is interpreted as an array of size 1), or
 * missing for no payload. payloadB may be omitted. If present, it must be an
 * array of numbers, of which each is a single extra byte. payloadB is intended
 * for payloads that are not of a size multiple of 32 bits.
 *
 * The INPUT command is allowed to omit the payload and instead provide the
 * input like so:
 *
 * {
 *    "cmd": "INPUT",
 *    "frame": (frame number),
 *    "player": (player number),
 *    "input": (input)
 * }
 *
 * The player may omitted if it's 0.
 *
 * The input may numeric or in a string format, in which each character
 * represents a button which is pressed. The characters are BYsSudlrAXLR, with
 * meanings exactly as in LSMV. L2, L3, R2 and R3 are not supported in string
 * format, and analog input is not supported in the expanded format at all.
 */

// Canonicalize a packet
function canonicalize(cmd)
{
   var out = {"cmd": cmd.cmd, "payload": cmd.payload, "payloadB": cmd.payloadB};

   if (typeof cmd.cmd === "string")
      out.cmd = commands[cmd.cmd];
   if (typeof out.cmd !== "number")
      return out;

   if (typeof cmd.payloadB !== "undefined" &&
       cmd.payloadB.length > 0)
      out.payloadB = cmd.payloadB;

   if (out.cmd === commands.INPUT) {
      if (typeof cmd.frame !== "undefined" &&
          typeof cmd.input !== "undefined") {
         var input = out.input;
         out.frame = cmd.frame;
         if (typeof cmd.player !== "undefined")
            out.player = cmd.player;
         else
            out.player = 0;
         out.input = cmd.input;

         if (typeof out.input === "string") {
            // Convert to number
            input = 0;
            for (var oi = 0; oi < cmd.input.length; oi++) {
               var oic = inputs[cmd.input[oi]];
               if (typeof oic === "number")
                  input |= 1<<oic;
            }
            out.input = input;
         }

         // Now convert it to a payload
         out.payload = [out.frame, out.player, out.input, 0, 0];
      }
   }

   if (typeof out.payload === "number")
      out.payload = [out.payload];
   if (typeof out.payload === "undefined")
      out.payload = [];

   return out;
}
exports.canonicalize = canonicalize;

// Generate a packet for a command
function gen(cmd, payload)
{
   if (typeof payload !== "undefined") {
      // command+payload format
      return gen({"cmd": cmd, "payload": payload});
   }

   cmd = canonicalize(cmd);

   var buf = Buffer.alloc((cmd.payload.length+2) * 4);
   buf.writeUInt32BE(cmd.cmd, 0);
   buf.writeUInt32BE(cmd.payload.length * 4, 4);

   for (var i = 0; i < cmd.payload.length; i++)
      buf.writeUInt32BE(cmd.payload[i], 8+i*4);

   return buf;
}
exports.gen = gen;

// Generate a trailer, used to make sure movies don't end/disconnect too early
function genTrailer(into, frame)
{
   for (var i = 0; i < 60; i++)
      into.write(gen({"cmd": "INPUT", "frame": frame+i, "input": 0}));
}
exports.genTrailer = genTrailer;

// Parse a packet
function parse(buf, offset)
{
   var out = {};

   if (offset >= buf.length)
      return null;
   var cmd = buf.readUInt32BE(offset);
   out.cmd = cmd;
   var size = buf.readUInt32BE(offset+4);

   var payload = new Array(~~(size/4));
   for (var oi = 0; oi < payload.length; oi++)
      payload[oi] = buf.readUInt32BE(offset+8+oi*4);
   out.payload = payload;

   // Any extra bytes of payload
   if ((size % 4) !== 0) {
      var payloadB = new Array(size % 4);
      var base = ~~(size/4) * 4;
      for (var oi = 0; oi < payloadB.length; oi++)
         payloadB[oi] = buf[offset+8+base+oi];
      out.payloadB = payloadB;
   }

   // If it's an input command, clarify it
   if (cmd === commands.INPUT &&
       !(payload[3] || payload[4])) {
      // Input command with no analog
      out.frame = payload[0];
      if (payload[1]) out.player = payload[1];
      out.input = payload[2];
   }

   return out;
}
exports.parse = parse;
