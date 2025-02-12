import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseTranscript(rawInput)
{
    return rawInput
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]+/gu, "")
        .split(/\s+/)
        .filter(Boolean);
}

function countWords(wordsArray)
{
    return wordsArray.reduce((acc, word) =>
    {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
    }, {});
}

function createSortedWordObjects(wordCounts)
{
    return Object.entries(wordCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([word, count]) => ({
            text: word,
            count,
            classification: ["Default"]
        }));
}

function updateOutputFile(outputData)
{
    const outputPath = path.join(__dirname, "../docs/datasets/last_analysis.json");
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf8");
}

function createPrompt(word, config)
{
    return `Klassifiziere das Wort "'${word}'" mit passenden Tags aus dieser Liste: ${JSON.stringify(
        config.classificationTags
    )}.
Beachte, dass mehrere Tags zutreffen können. Wenn keiner eindeutig passt, füge "Default" hinzu.
Antworte ausschließlich mit einem plain JSON Objekt {"tags":[..]}.
Beginne die JSON Ausgabe mit \`\`\`json und beende sie mit \`\`\``;
}

async function classifyWord(wordObj, index, config)
{
    console.log(`[${index + 1}/${config.totalWords}] Sende Wort an LLM: ${wordObj.text}`);
    const startTime = Date.now();

    try
    {
        const prompt = createPrompt(wordObj.text, config);
        const response = await fetch(config.apiURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: config.llmModel,
                prompt,
                stream: false
            })
        });

        if (!response.ok)
        {
            console.log("Unerwartete Response:", await response.text());
            wordObj.classification = ["#error"];
            return wordObj;
        }

        const data = await response.json();
        let rawResponse = data.response;

        if (config.searchStringStart && config.searchStringEnd)
        {
            const startIdx = rawResponse.indexOf(config.searchStringStart);
            const endIdx = rawResponse.indexOf(config.searchStringEnd, startIdx + config.searchStringStart.length);
            if (startIdx !== -1 && endIdx !== -1)
            {
                rawResponse = rawResponse.substring(startIdx + config.searchStringStart.length, endIdx);
            }
        }

        try
        {
            const parsedResponse = JSON.parse(rawResponse);
            wordObj.classification = (parsedResponse.tags || []).filter(tag =>
                config.classificationTags.includes(tag)
            ) || ["Default"];
        } catch
        {
            console.log("Model hat unerwartete Antwort:", rawResponse);
            wordObj.classification = ["#error"];
        }
        return wordObj;
    } catch (error)
    {
        console.error(`Fehler bei '${wordObj.text}':`, error);
        wordObj.classification = ["#error"];
        return wordObj;
    } finally
    {
        console.log(`Rechenzeit: ${(Date.now() - startTime) / 1000} s`);
    }
}

async function processWords(sortedWords, config)
{
    const processedWords = [];
    for (let i = 0; i < sortedWords.length; i++)
    {
        const classifiedWord = await classifyWord(sortedWords[i], i, config);
        processedWords.push(classifiedWord);
        updateOutputFile({ ...config, words: processedWords });
    }
    return processedWords;
}

async function main()
{
    try
    {
        const configPath = path.join(__dirname, "analysis-input.json");
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

        const rawInput = config.transcript;
        const wordsArray = parseTranscript(rawInput);
        const wordCounts = countWords(wordsArray);
        const sortedWords = createSortedWordObjects(wordCounts);

        config.totalWords = sortedWords.length;

        const outputData = {
            youtubeTitle: config.title || "N/A",
            source: config.source || "N/A",
            totalWords: wordsArray.length,
            uniqueWords: sortedWords.length,
            llmModel: config.llmModel,
            analysisHardware: config.analysisHardware || "",
            analysisStarted: new Date().toISOString(),
            classificationTags: config.classificationTags || ["Default"],
            words: [],
            transcript: rawInput
        };

        updateOutputFile(outputData);

        const processedWords = await processWords(sortedWords, config);
        outputData.words = processedWords;
        updateOutputFile(outputData);

        console.log("Klassifizierung abgeschlossen.");
    } catch (error)
    {
        console.error("Fehler bei der Analyse:", error);
    }
}

main();
