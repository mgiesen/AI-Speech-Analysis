let originalData = null;
let activeTags = new Set();
let tagChart, wordChart, wordDataTable;

document.addEventListener("DOMContentLoaded", () =>
{
    showLoader();

    // Lade Liste aller Datensätze
    fetch('datasets.json')
        .then(response => response.json())
        .then(datasetList =>
        {
            populateDatasetDropdown(datasetList.datasets);
            return fetch('datasets/cdu.json');
        })
        .then(response =>
        {
            document.getElementById("datasetDropdown").value = 'datasets/cdu.json';
            return response.json();
        })
        .then(data =>
        {
            originalData = data;
            loadInfo(data);
            loadTranscript(data);
            createTagButtons(data);
            createCharts(data);
            initDataTable();
            updateDataTable();
        })
        .catch(error =>
        {
            console.error('Error:', error);
            document.body.innerHTML = `
				<div class="container text-center text-danger p-5">
					<h2 class="mb-3">Fehler beim Laden der Daten</h2>
					<p>${error.message}</p>
				</div>
			`;
        })
        .finally(() =>
        {
            hideLoader();
        });

    document.getElementById("datasetDropdown").addEventListener("change", (e) =>
    {
        if (!e.target.value) return;
        showLoader();
        fetch(e.target.value)
            .then(res => res.json())
            .then(data =>
            {
                originalData = data;
                loadInfo(data);
                loadTranscript(data);
                createTagButtons(data);
                updateCharts();
                updateDataTable();
            })
            .catch(err => console.error(err))
            .finally(() =>
            {
                hideLoader();
            });
    });
});

function showLoader()
{
    document.getElementById("loader").classList.remove("hidden");
}

function hideLoader()
{
    document.getElementById("loader").classList.add("hidden");
}

function populateDatasetDropdown(datasets)
{
    const dropdown = document.getElementById("datasetDropdown");
    datasets.forEach(ds =>
    {
        const option = document.createElement("option");
        option.value = ds.path;
        option.textContent = ds.title;
        dropdown.appendChild(option);
    });
}

function loadInfo(data)
{
    document.getElementById('title').textContent = data.title || "N/A";
    document.getElementById('total-words').textContent = data.totalWords || "N/A";
    document.getElementById('unique-words').textContent = data.uniqueWords || "N/A";
    document.getElementById('analysis-duration').textContent = data.analysisDuration || "N/A";
    document.getElementById('llm-model').textContent = data.llmModel || "N/A";
    document.getElementById('analysis-hardware').textContent = data.analysisHardware || "N/A";

    if (data.source.startsWith('http'))
    {
        source.innerHTML = `<a href="${data.source}" target="_blank">Link</a>`;
    } else
    {
        source.textContent = data.source || "N/A";
    }
}

function loadTranscript(data)
{
    document.getElementById("video-transcript").textContent = data.transcript || "";
}

function createTagButtons(data)
{
    const container = document.getElementById('tag-filters');
    container.innerHTML = '';
    activeTags.clear();

    data.classificationTags.forEach(tag =>
    {
        const btn = document.createElement('button');
        btn.className = 'tag-button active';
        btn.textContent = tag;
        activeTags.add(tag);
        btn.addEventListener('click', () =>
        {
            btn.classList.toggle('active');
            if (activeTags.has(tag))
            {
                activeTags.delete(tag);
            } else
            {
                activeTags.add(tag);
            }
            updateDataTable();
            updateCharts();
        });
        container.appendChild(btn);
    });
}

function initDataTable()
{
    wordDataTable = $('#wordTable').DataTable({
        language: {
            info: "Zeige _START_ bis _END_ von _TOTAL_ Einträgen (Gesamt: _MAX_)",
            search: "Suchen:",
            paginate: {
                previous: "Zurück",
                next: "Weiter"
            }
        },
        columns: [
            { title: "Wort" },
            { title: "Anzahl", className: "text-center" },
            { title: "Kategorien" }
        ]
    });
}

function updateDataTable()
{
    const filtered = originalData.words.filter(word =>
        word.classification.some(tag => activeTags.has(tag))
    );
    const tableRows = filtered.map(word => [
        word.text,
        word.count,
        word.classification.join(', ')
    ]);
    wordDataTable.clear();
    wordDataTable.rows.add(tableRows);
    wordDataTable.draw();
}

function createCharts(data)
{
    const tagCtx = document.getElementById('tagChart').getContext('2d');
    const wordCtx = document.getElementById('wordChart').getContext('2d');

    tagChart = new Chart(tagCtx, {
        type: 'bar',
        data: getTagChartData(data),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Anzahl' }
                }
            }
        }
    });

    wordChart = new Chart(wordCtx, {
        type: 'bar',
        data: getWordChartData(data),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context =>
                        {
                            const index = context.dataIndex;
                            const filtered = data.words
                                .filter(w => w.classification.some(tag => activeTags.has(tag)))
                                .sort((a, b) => b.count - a.count)
                                .slice(0, 10);
                            const label = filtered[index]?.text || "";
                            return label + ': ' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Anzahl' }
                },
                x: { display: false }
            }
        }
    });
}

function updateCharts()
{
    tagChart.data = getTagChartData(originalData);
    tagChart.update();
    wordChart.data = getWordChartData(originalData);
    wordChart.update();
}

function getTagChartData(data)
{
    const tagCounts = {};
    data.words.forEach(word =>
    {
        word.classification.forEach(tag =>
        {
            if (activeTags.has(tag))
            {
                tagCounts[tag] = (tagCounts[tag] || 0) + word.count;
            }
        });
    });
    const labels = Object.keys(tagCounts);
    const counts = labels.map(label => tagCounts[label]);
    return {
        labels: labels,
        datasets: [{
            label: 'Wortanzahl',
            data: counts,
            backgroundColor: 'rgba(13, 110, 253, 0.7)',
            borderColor: 'rgba(13, 110, 253, 1)',
            borderWidth: 1
        }]
    };
}

function getWordChartData(data)
{
    const filtered = data.words
        .filter(word => word.classification.some(tag => activeTags.has(tag)))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    return {
        labels: filtered.map(() => ''),
        datasets: [{
            label: 'Top Wörter',
            data: filtered.map(word => word.count),
            backgroundColor: 'rgba(220, 53, 69, 0.7)',
            borderColor: 'rgba(220, 53, 69, 1)',
            borderWidth: 1
        }]
    };
}
