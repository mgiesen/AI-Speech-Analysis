const fs = require("fs");
const path = require("path");

const startTime = Date.now();
const analysisStarted = new Date().toISOString();

const rawInput = fs.readFileSync(path.join(__dirname, "input.txt"), "utf8");

const wordsArray = rawInput
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .split(/\s+/)
    .filter(Boolean);

const totalWords = wordsArray.length;
const wordCounts = {};

wordsArray.forEach(word =>
{
    const lower = word.toLowerCase();
    wordCounts[lower] = (wordCounts[lower] || 0) + 1;
});

const uniqueWords = Object.keys(wordCounts).length;

const sortedWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([text, count]) => ({
        text,
        count,
        classification: ["Default"]
    }));

const outputData = {
    youtubeTitle: "Merzrede beim 37. Parteitag der CDU",
    youtubeLink: "https://www.youtube.com/watch?v=oHFYIpKOUkc",
    videoLength: "1:06:39",
    totalWords,
    uniqueWords,
    analysisDuration: `${Date.now() - startTime}ms`,
    llmModel: "",
    analysisStarted,
    classificationTags: ["Default"],
    words: sortedWords,
    transcript: rawInput.trim()
};

fs.writeFileSync(path.join(__dirname, "output.json"), JSON.stringify(outputData, null, 2), "utf8");
