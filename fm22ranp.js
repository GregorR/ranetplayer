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

// See http://www.fceux.com/web/FM2.html

const fs = require("fs");
const ranp = require("./ranp.js");

var inputFile = fs.readFileSync(process.argv[2], "utf8");
var outputFile = fs.createWriteStream(process.argv[3]);
var inputLines = inputFile.split("\n");

const inputLine = /^\|([0-9]*)\|(........)\|.*$/;

// Controls bitmap
const bitMap = [
    7, // Right
    6, // Left
    5, // Down
    4, // Up
    3, // Start
    2, // Select
    0, // B
    8  // A
];

// General command for writing to command buffers
var frame = 0;
for (var li = 0; li < inputLines.length; li++) {
    // Read in the line
    var line = inputLines[li].trim();
    if (line === "") continue;
    if (line[0] !== "|") continue;

    // Parse it
    var parts = inputLine.exec(line);
    if (parts === null) {
        console.error(`Unrecognized line: ${line}`);
        continue;
    }
    var commands = +parts[1];
    var controls = parts[2];

    if (commands & 1) {
        // Soft reset 
        outputFile.write(ranp.gen(ranp.commands.RESET, frame));
    }
    if (commands & (~1))
        console.error(`Unrecognized command ${commands}!`);

    // Convert the controls
    var raControls = 0;
    for (var ci = 0; ci < bitMap.length; ci++) {
        if (controls[ci] !== ".") raControls |= (1<<bitMap[ci]);
    }

    // Now generate the input command
    outputFile.write(ranp.gen({"cmd": ranp.commands.INPUT, "frame": frame, "input": raControls}));
    frame++;
}

ranp.genTrailer(outputFile, frame);
outputFile.end();
