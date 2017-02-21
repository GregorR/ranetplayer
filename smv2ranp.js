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

// See http://tasvideos.org/EmulatorResources/Snes9x/SMV.html

const fs = require("fs");
const ranp = require("./ranp.js");

var inputFile = fs.readFileSync(process.argv[2]);
var outputFile = fs.createWriteStream(process.argv[3]);

// Mapping of SMV bits to RANP bits
const bitMap = [
    0, 0, 0, 0,
    11, // R
    10, // L
    9,  // X
    8,  // A
    7,  // Right
    6,  // Left
    5,  // Down
    4,  // Up
    3,  // Start
    2,  // Select
    1,  // Y
    0   // B
];

// General command for writing to command buffers
var cmd = null;
var cur = 0;
function write(part) {
    cmd.writeUInt32BE(part, cur);
    cur += 4;
}

// Start with a reset (FIXME: Savestates eventually maybe)
outputFile.write(ranp.gen(ranp.commands.RESET, 0));

// Validate our input file
var version = inputFile.readUInt32LE(4);
if (inputFile.readUInt32BE(0) !== 0x534D561A ||
    (version !== 1 && version !== 4))
    console.error("This doesn't seem to be an SMV file!");
if (inputFile[0x15] !== 1)
    console.error(`SMV file uses unsupported options (${inputFile[0x15]}).`);

// Figure out our input format
var controllers = 0;
var controllerBits = inputFile[0x14];
for (var ci = 0; ci < 5; ci++)
    if (controllerBits & (1<<ci)) controllers++;

// And how many frames
var frames = inputFile.readUInt32LE(0x10);
var frameOffset = inputFile.readUInt32LE(0x1C);

// Now start reading
var frame = 0;
for (var fi = 0; fi < frames; fi++) {
    var off = frameOffset + 2*controllers*fi;

    // Two bytes per controller, we only care about the first one
    var frameInput = inputFile.readUInt16LE(off);
    var raControls = 0;

    // Map controller buttons
    for (var ci = 4; ci < bitMap.length; ci++)
        if (frameInput & (1<<ci)) raControls |= (1<<bitMap[ci]);

    // Now generate the input command
    outputFile.write(ranp.gen({"cmd": ranp.commands.INPUT, "frame": frame, "input": raControls}));
    frame++;
}

ranp.genTrailer(outputFile, frame);
outputFile.end();
