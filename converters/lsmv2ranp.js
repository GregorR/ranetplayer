#!/usr/bin/env node
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

var fs = require("fs");

var inputFile = fs.readFileSync(process.argv[2], "utf8");
var outputFile = fs.createWriteStream(process.argv[3]);
var inputLines = inputFile.split("\n");

const startOffset = +process.argv[4];
const inputLine = /^F\.( 0)?( 0)?\|(............)$/;

// General command for writing to command buffers
var cmd = null;
var cur = 0;
function write(part) {
    cmd.writeUInt32BE(part, cur);
    cur += 4;
}

// Start with a reset (FIXME: Savestates eventually maybe)
cmd = Buffer.alloc(3*4); cur = 0;
write(0x46); // NETPLAY_CMD_RESET
write(4); // Size of reset payload
write(0); // Reset at frame 0
outputFile.write(cmd);

// Offset by some fixed number of frames
cmd = Buffer.alloc(7*4); cur = 0;
write(3); // NETPLAY_CMD_INPUT
write(5*4); // Size of input payload
for (var i = 0; i < 5; i++)
   write(0);
for (var fi = 0; fi < startOffset; fi++)
{
   cmd.writeUInt32BE(fi, 8);
   outputFile.write(cmd);
   cmd = Buffer.from(cmd);
}

var frame = startOffset;
for (var li = 0; li < inputLines.length; li++) {
    // Read in the line
    var line = inputLines[li].trim();
    if (line === "") continue;

    // Parse it
    var parts = inputLine.exec(line);
    if (parts === null)
        console.error(`Unrecognized line: ${line}`);
    var controls = parts[3];

    /* It's easy to convert the controls, as (presumably by no coincidence)
     * they're in the exact same order as in RA */
    var raControls = 0;
    for (var ci = 0; ci < 12; ci++) {
        if (controls[ci] !== ".") raControls |= (1<<ci);
    }

    // Now generate the input command
    if (frame >= 0) {
       cmd = Buffer.alloc(7*4); cur = 0;
       write(3); // NETPLAY_CMD_INPUT
       write(5*4); // Size of input payload
       write(frame);
       write(0);
       write(raControls);
       write(0);
       write(0);
       outputFile.write(cmd);
    }
    frame++;
}

outputFile.end();
