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
   "MODE": 0x26,
   "CRC": 0x40,
   "LOAD_SAVESTATE": 0x42,
   "RESET": 0x46,
   "FLIP_PLAYERS": 0x60
};
exports.commands = commands;

// Generate a packet for a command
function gen(cmd, payload)
{
   var buf = Buffer.alloc((payload.length+2) * 4);
   buf.writeUInt32BE(cmd, 0);
   buf.writeUInt32BE(payload.length * 4, 4);

   for (var i = 0; i < payload.length; i++)
      buf.writeUInt32BE(payload[i], 8+i*4);

   return buf;
}
exports.gen = gen;

// Generate a packet for an INPUT command
function genInput(frame, buttons, analog1, analog2)
{
   if (typeof analog1 === "undefined")
      analog1 = 0;
   if (typeof analog2 === "undefined")
      analog2 = 0;
   return gen(commands.INPUT, [frame, 0, buttons, analog1, analog2]);
}
exports.genInput = genInput;

// Generate a trailer, used to make sure movies don't end/disconnect too early
function genTrailer(into, frame)
{
   for (var i = 0; i < 60; i++)
      into.write(genInput(frame+i, 0));
}
exports.genTrailer = genTrailer;

// Parse a packet
function parse(buf, offset)
{
   if (offset >= buf.length)
      return null;
   var cmd = buf.readUInt32BE(offset);
   var size = buf.readUInt32BE(offset+4);
   // FIXME: Non-multiple-of-4 payloads
   var payload = new Array(~~((size+3)/4));
   for (var oi = 0; oi < payload.length; oi++)
      payload[oi] = buf.readUInt32BE(offset+8+oi*4);
   return {
      "cmd": cmd,
      "payload": payload,
      "next": offset + 8 + size
   };
}
exports.parse = parse;
