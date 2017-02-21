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

/*
 * See http://tasvideos.org/Lsnes/Movieformat.html
 *
 * Note: LSMV files are ZIP files. To convert one using this tool, extract it
 * first, then point this tool at the file named "input" inside the extracted
 * directory.
 */

const fs = require("fs");
const ranp = require("./ranp.js");

var inputFile = fs.readFileSync(process.argv[2], "utf8");
var outputFile = fs.createWriteStream(process.argv[3]);
var inputLines = inputFile.split("\n");

const inputLine = /^F\.?( 0)?( 0)?\|(............)$/;

// Start with a reset (FIXME: Savestates eventually maybe)
outputFile.write(ranp.gen(ranp.commands.RESET, 0));

var frame = 0;
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
    if (frame >= 0)
       outputFile.write(ranp.gen({"cmd": ranp.commands.INPUT, "frame": frame, "input": raControls}));
    frame++;
}

ranp.genTrailer(outputFile, frame);
outputFile.end();
