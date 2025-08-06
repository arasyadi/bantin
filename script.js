// Global variables
let speciesDatabase = {};
let classificationRules = {};
let currentMode = 'age';
let csvData = [];
let myChart = null;
let currentSpecies = null;
let calculationResults = [];

// Initialize app after loading external data
document.addEventListener('DOMContentLoaded', () => {
  loadDataAndInit();
});

async function loadDataAndInit() {
  try {
    const [speciesRes, rulesRes] = await Promise.all([
      fetch('species_database.json'),
      fetch('classification_rules.json')
    ]);

    if (!speciesRes.ok || !rulesRes.ok) {
      throw new Error('Gagal memuat file data JSON.');
    }

    speciesDatabase = await speciesRes.json();
    classificationRules = await rulesRes.json();

    // Now that data is loaded, initialize the app's event listeners and functionality
    initializeApp();

  } catch (error) {
    console.error("Initialization failed:", error);
    alert("Gagal memuat data aplikasi. Mohon refresh halaman untuk mencoba lagi.");
  }
}

function initializeApp() {
  // Species autocomplete
  document.getElementById("species").addEventListener("input", function(e) {
    const query = e.target.value.toLowerCase();
    const suggestionsContainer = document.getElementById("species-suggestions");
    suggestionsContainer.innerHTML = '';

    if (query.length < 2) {
      suggestionsContainer.style.display = 'none';
      return;
    }

    const matches = Object.keys(speciesDatabase).filter(species =>
      species.toLowerCase().includes(query)
    ).slice(0, 5);

    if (matches.length) {
      matches.forEach(species => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = species;
        div.onclick = () => {
          document.getElementById('species').value = species;
          suggestionsContainer.style.display = 'none';
          currentSpecies = species;
          if (speciesDatabase[species]) {
            document.getElementById('linf').value = speciesDatabase[species].linf;
            document.getElementById('k').value = speciesDatabase[species].k;
            if (document.getElementById('a')) {
              document.getElementById('a').value = speciesDatabase[species].a;
            }
            if (document.getElementById('b')) {
              document.getElementById('b').value = speciesDatabase[species].b;
            }
          }
        };
        suggestionsContainer.appendChild(div);
      });
      suggestionsContainer.style.display = 'block';
    } else {
      suggestionsContainer.style.display = 'none';
    }
	
	if (currentMode === 'multispecies') {
  // Format: species,length,weight
  csvData = [];
  lines.forEach((line, index) => {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      const species = parts[0];
      const length = parseFloat(parts[1]);
      const weight = parseFloat(parts[2]);
      
      if (!isNaN(length) && !isNaN(weight)) {
        csvData.push({
          species: species,
          length: length,
          weight: weight
        });
      }
    }
  });
}
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', function(e) {
    if (e.target.id !== 'species') {
      document.getElementById('species-suggestions').style.display = 'none';
    }
  });

  // Mode selector event listeners
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      switchMode(this.dataset.mode);
    });
  });

  // CSV file input handler
  document.getElementById("csvInput").addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById("fileName").textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(event) {
      const lines = event.target.result.split(/\r?\n/).filter(line => line.trim());
      csvData = [];

      try {
        if (currentMode === 'age') {
          // Single column: length only
          csvData = lines.map(l => ({
            length: parseFloat(l.trim())
          })).filter(v => !isNaN(v.length));
        } else {
          // Two columns: length, weight
          csvData = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 2) {
              return {
                length: parseFloat(parts[0]),
                weight: parseFloat(parts[1])
              };
            }
            return null;
          }).filter(v => v !== null && !isNaN(v.length) && !isNaN(v.weight));
        }

        updateStatistics();
      } catch (error) {
        alert("Error membaca file CSV: " + error.message);
      }
    };
    reader.readAsText(file);
  });

  updateStatistics();
}

// Fungsi baru untuk analisis multispecies
function calculateMultispeciesAnalysis() {
  if (csvData.length === 0) {
    alert("Silakan unggah file CSV dengan data multispecies!");
    return;
  }

  const doAge = document.getElementById('chk-age').checked;
  const doLWR = document.getElementById('chk-lwr').checked;
  
  if (!doAge && !doLWR) {
    alert("Pilih setidaknya satu jenis analisis!");
    return;
  }

  showLoading(true);

  setTimeout(() => {
    try {
      // Kelompokkan data per spesies
      const speciesGroups = {};
      csvData.forEach(item => {
        if (!speciesGroups[item.species]) {
          speciesGroups[item.species] = [];
        }
        speciesGroups[item.species].push(item);
      });

      calculationResults = [];

      // Untuk setiap spesies, lakukan analisis yang dipilih
      Object.keys(speciesGroups).forEach(species => {
        const groupData = speciesGroups[species];
        const result = {
          species: species,
          lengthData: groupData.map(d => d.length),
          weightData: groupData.map(d => d.weight)
        };

        // Hitung statistik dasar
        const lengthStats = calculateStatistics(result.lengthData);
        result.avgLength = lengthStats.avg;
        result.minLength = lengthStats.min;
        result.maxLength = lengthStats.max;
        
        const weightStats = calculateStatistics(result.weightData);
        result.avgWeight = weightStats.avg;

        // Jika analisis usia dipilih
        if (doAge) {
          // Ambil parameter dari database jika ada
          const speciesParams = speciesDatabase[species] || {};
          const linf = speciesParams.linf || parseFloat(document.getElementById("linf").value) || 30.66;
          const k = speciesParams.k || parseFloat(document.getElementById("k").value) || 0.34;
          
          // Hitung usia untuk setiap panjang
          const ages = [];
          groupData.forEach(data => {
            const Lt = data.length;
            if (Lt < linf) {
              const t = -(1 / k) * Math.log(1 - (Lt / linf));
              ages.push(t);
            }
          });
          
          if (ages.length > 0) {
            const ageStats = calculateStatistics(ages);
            result.avgAge = ageStats.avg;
          } else {
            result.avgAge = null;
          }
        }
        
        // Jika analisis LWR dipilih
        if (doLWR) {
          // Gunakan data seluruh grup untuk menghitung parameter LWR
          const log10Length = groupData.map(d => Math.log10(d.length));
          const log10Weight = groupData.map(d => Math.log10(d.weight));
          
          const regressionData = log10Length.map((val, idx) => [val, log10Weight[idx]]);
          const resultReg = regression.linear(regressionData);
          const b = resultReg.equation[0];
          const a = Math.pow(10, resultReg.equation[1]);
          
          result.a = a;
          result.b = b;
          
          // Tentukan pola pertumbuhan berdasarkan b
          if (b < 2.5) {
            result.growthPattern = "Allometrik negatif (lebih memanjang)";
          } else if (b > 3.5) {
            result.growthPattern = "Allometrik positif (lebih menggemuk)";
          } else {
            result.growthPattern = "Isometrik (proporsional)";
          }
          
          // Hitung faktor kondisi per data, lalu rata-rata
          const conditionFactors = groupData.map(d => {
            return (d.weight / Math.pow(d.length, 3)) * 100;
          });
          const conditionStats = calculateStatistics(conditionFactors);
          result.avgCondition = conditionStats.avg;
          
          // Interpretasi kondisi
          if (result.avgCondition >= 1.2) {
            result.conditionInterpretation = "Kondisi sangat baik";
          } else if (result.avgCondition >= 1.0) {
            result.conditionInterpretation = "Kondisi baik";
          } else if (result.avgCondition >= 0.8) {
            result.conditionInterpretation = "Kondisi cukup";
          } else {
            result.conditionInterpretation = "Kondisi kurang";
          }
        }
        
        calculationResults.push(result);
      });

      displayMultispeciesResults();
      renderMultispeciesChart();

    } catch (error) {
      alert("Error dalam perhitungan multispecies: " + error.message);
    } finally {
      showLoading(false);
    }
  }, 1000);
}

// Fungsi untuk menampilkan hasil multispecies
function displayMultispeciesResults() {
  const tableBody = document.getElementById("multispeciesBody");
  tableBody.innerHTML = "";

  calculationResults.forEach(result => {
    const row = document.createElement("tr");
    
    let ageCell = "N/A";
    if (result.avgAge !== undefined && result.avgAge !== null) {
      ageCell = result.avgAge.toFixed(2);
    }
    
    let growthCell = "N/A";
    if (result.growthPattern) {
      growthCell = result.growthPattern;
    }
    
    let conditionCell = "N/A";
    if (result.avgCondition !== undefined) {
      conditionCell = `${result.conditionInterpretation} (${result.avgCondition.toFixed(2)})`;
    }
    
    row.innerHTML = `
      <td>${result.species}</td>
      <td>${result.avgLength.toFixed(2)}</td>
      <td>${result.avgWeight.toFixed(2)}</td>
      <td>${ageCell}</td>
      <td>${growthCell}</td>
      <td>${conditionCell}</td>
    `;
    tableBody.appendChild(row);
  });
}

// Fungsi untuk menampilkan grafik multispecies
function renderMultispeciesChart() {
  const ctx = document.getElementById("mainChart").getContext("2d");
  if (myChart) {
    myChart.destroy();
  }

  // Siapkan dataset untuk setiap spesies
  const datasets = [];
  const colors = ['#2c6fbb', '#4caf50', '#ff9800', '#dc3545', '#6c757d']; // Warna berbeda untuk setiap spesies

  calculationResults.forEach((result, index) => {
    const scatterData = [];
    for (let i = 0; i < result.lengthData.length; i++) {
      scatterData.push({
        x: result.lengthData[i],
        y: result.weightData[i]
      });
    }

    datasets.push({
      label: result.species,
      data: scatterData,
      backgroundColor: colors[index % colors.length],
      pointRadius: 5,
      pointHoverRadius: 7
    });
  });

  myChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Panjang (cm)'
          },
          type: 'linear',
          position: 'bottom'
        },
        y: {
          title: {
            display: true,
            text: 'Berat (gram)'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return `${context.dataset.label}: ${point.x.toFixed(2)} cm, ${point.y.toFixed(2)} g`;
            }
          }
        }
      }
    }
  });

  document.getElementById("downloadChartBtn").style.display = "block";
}

// Fungsi untuk download hasil multispecies
function downloadMultispeciesResults() {
  if (calculationResults.length === 0) {
    alert("Tidak ada data untuk diunduh. Silakan hitung analisis terlebih dahulu.");
    return;
  }

  let csvContent = "Spesies,Rata-rata Panjang (cm),Rata-rata Berat (g),Rata-rata Usia (tahun),Pola Pertumbuhan,Faktor Kondisi\n";

  calculationResults.forEach(result => {
    let age = result.avgAge !== undefined && result.avgAge !== null ? result.avgAge.toFixed(2) : 'N/A';
    let growth = result.growthPattern || 'N/A';
    let condition = result.avgCondition !== undefined ? `${result.conditionInterpretation} (${result.avgCondition.toFixed(2)})` : 'N/A';

    csvContent += `"${result.species}",${result.avgLength.toFixed(2)},${result.avgWeight.toFixed(2)},${age},"${growth}","${condition}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "analisis_multispecies_teripang.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function switchMode(mode) {
  // Update active button
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

  currentMode = mode;

  // Show/hide relevant sections
  if (mode === 'age') {
    document.getElementById('age-parameters').classList.remove('hidden');
    document.getElementById('lwr-parameters').classList.add('hidden');
    document.getElementById('calculate-btn-text').textContent = 'Hitung Prediksi Usia';
    document.getElementById('stat-title').textContent = 'Statistik Data Panjang';
    document.getElementById('chart-title').textContent = 'Visualisasi Pertumbuhan';
    document.getElementById('result-table-title').textContent = 'Hasil Prediksi Usia';

    // Update table headers
    document.getElementById('tableHeader').innerHTML = `
          <tr>
            <th>Panjang (cm)</th>
            <th>Usia (tahun)</th>
            <th>Usia (bulan)</th>
            <th>Prediksi Lt+1 (cm)</th>
          </tr>
        `;
  } else {
    document.getElementById('age-parameters').classList.add('hidden');
    document.getElementById('lwr-parameters').classList.remove('hidden');
    document.getElementById('calculate-btn-text').textContent = 'Hitung Analisis LWR & Fulton';
    document.getElementById('stat-title').textContent = 'Statistik Data Input';
    document.getElementById('chart-title').textContent = 'Hubungan Panjang-Berat';
    document.getElementById('result-table-title').textContent = 'Hasil Analisis LWR & Fulton';

    // Update table headers
    document.getElementById('tableHeader').innerHTML = `
          <tr>
            <th>Panjang (cm)</th>
            <th>Berat Aktual (g)</th>
            <th>Berat Prediksi (g)</th>
            <th>Faktor Kondisi (K)</th>
          </tr>
        `;
  
  } else if (mode === 'multispecies') {
  document.getElementById('multispecies-params').classList.remove('hidden');
  document.getElementById('calculate-btn-text').textContent = 'Hitung Analisis Multispecies';
  document.getElementById('stat-title').textContent = 'Statistik Data Multispecies';
  document.getElementById('chart-title').textContent = 'Grafik Hubungan Panjang-Berat Multispecies';
  document.getElementById('result-table-title').textContent = 'Hasil Analisis Multispecies';
  
  document.getElementById('resultTable').classList.add('hidden');
  document.getElementById('multispeciesTable').classList.remove('hidden');
  }

  // Reset data and UI
  csvData = [];
  calculationResults = [];
  document.getElementById("fileName").textContent = "Belum ada file dipilih";
  document.getElementById("csvInput").value = "";
  resetResults();
  updateStatistics();
}

function calculateStatistics(data, property = null) {
  if (data.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      stdDev: 0
    };
  }

  const values = property ? data.map(d => d[property]) : data;
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / count;

  const median = count % 2 === 0 ?
    (sorted[count / 2 - 1] + sorted[count / 2]) / 2 :
    sorted[Math.floor(count / 2)];

  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    min,
    max,
    avg,
    median,
    stdDev
  };
}

function updateStatistics() {
  if (currentMode === 'age') {
    const stats = calculateStatistics(csvData, 'length');
    document.getElementById("sampleCount").textContent = stats.count;
    document.getElementById("minLength").textContent = stats.min.toFixed(2);
    document.getElementById("maxLength").textContent = stats.max.toFixed(2);
    document.getElementById("avgLength").textContent = stats.avg.toFixed(2);
    document.getElementById("median").textContent = stats.median.toFixed(2);
    document.getElementById("stdDev").textContent = stats.stdDev.toFixed(2);

    // Update labels
    document.getElementById("minLabel").textContent = "Panjang Minimum";
    document.getElementById("maxLabel").textContent = "Panjang Maksimum";
    document.getElementById("avgLabel").textContent = "Rata-rata Panjang";
    document.getElementById("minUnit").textContent = "cm";
    document.getElementById("maxUnit").textContent = "cm";
    document.getElementById("avgUnit").textContent = "cm";
    document.getElementById("medianUnit").textContent = "cm";
    document.getElementById("stdUnit").textContent = "cm";
  } else {
    if (csvData.length > 0) {
      // LWR mode - show both length and weight stats
      const lengthStats = calculateStatistics(csvData, 'length');
      const weightStats = calculateStatistics(csvData, 'weight');

      document.getElementById("sampleCount").textContent = lengthStats.count;
      document.getElementById("minLength").textContent = `L: ${lengthStats.min.toFixed(2)} | W: ${weightStats.min.toFixed(2)}`;
      document.getElementById("maxLength").textContent = `L: ${lengthStats.max.toFixed(2)} | W: ${weightStats.max.toFixed(2)}`;
      document.getElementById("avgLength").textContent = `L: ${lengthStats.avg.toFixed(2)} | W: ${weightStats.avg.toFixed(2)}`;
      document.getElementById("median").textContent = `L: ${lengthStats.median.toFixed(2)} | W: ${weightStats.median.toFixed(2)}`;
      document.getElementById("stdDev").textContent = `L: ${lengthStats.stdDev.toFixed(2)} | W: ${weightStats.stdDev.toFixed(2)}`;

      // Update labels
      document.getElementById("minLabel").textContent = "Minimum";
      document.getElementById("maxLabel").textContent = "Maksimum";
      document.getElementById("avgLabel").textContent = "Rata-rata";
      document.getElementById("minUnit").textContent = "cm | g";
      document.getElementById("maxUnit").textContent = "cm | g";
      document.getElementById("avgUnit").textContent = "cm | g";
      document.getElementById("medianUnit").textContent = "cm | g";
      document.getElementById("stdUnit").textContent = "cm | g";
    } else {
      // Reset to zero values
      document.getElementById("sampleCount").textContent = "0";
      document.getElementById("minLength").textContent = "0.00";
      document.getElementById("maxLength").textContent = "0.00";
      document.getElementById("avgLength").textContent = "0.00";
      document.getElementById("median").textContent = "0.00";
      document.getElementById("stdDev").textContent = "0.00";
    }
  }
}

function calculateAnalysis() {
  if (csvData.length === 0) {
    alert("Silakan unggah file CSV dengan data teripang!");
    return;
  }

  showLoading(true);

  setTimeout(() => {
    try {
      if (currentMode === 'age') {
        calculateAgeAnalysis();
      } else {
        calculateLWRAnalysis();
      }
    } catch (error) {
      alert("Error dalam perhitungan: " + error.message);
    } finally {
      showLoading(false);
    }
  }, 1000);

} else if (currentMode === 'multispecies') {
  calculateMultispeciesAnalysis();
}

function calculateAgeAnalysis() {
  const linf = parseFloat(document.getElementById("linf").value);
  const k = parseFloat(document.getElementById("k").value);
  const species = document.getElementById("species").value;

  if (!linf || !k || linf <= 0 || k <= 0) {
    alert("Mohon isi parameter L∞ dan K dengan nilai yang valid!");
    return;
  }

  currentSpecies = species;
  calculationResults = [];

  // Calculate age for each length
  csvData.forEach((data, index) => {
    const Lt = data.length;
    if (Lt >= linf) {
      // Skip if length is equal or greater than L infinity
      return;
    }

    const t = -(1 / k) * Math.log(1 - (Lt / linf));
    const Lt1 = linf * (1 - Math.exp(-k * (t + 1)));

    calculationResults.push({
      length: Lt,
      age: t,
      ageMonths: t * 12,
      predictedLength: Lt1
    });
  });

  if (calculationResults.length === 0) {
    alert("Tidak ada data yang dapat diproses. Pastikan nilai panjang lebih kecil dari L∞.");
    return;
  }

  displayAgeResults();
  renderAgeChart(linf, k);
  updateResultStatistics();
  showInterpretation();
}

function calculateLWRAnalysis() {
  // Filter data invalid
  csvData = csvData.filter(d => d.length > 0 && d.weight > 0);
  
  let a = parseFloat(document.getElementById("a").value);
  let b = parseFloat(document.getElementById("b").value);

  if (!a || !b || isNaN(a) || isNaN(b)) {
    // Gunakan log10
    const log10Length = csvData.map(d => Math.log10(d.length));
    const log10Weight = csvData.map(d => Math.log10(d.weight));

    const regressionData = log10Length.map((val, i) => [val, log10Weight[i]]);
    const result = regression.linear(regressionData);

    b = result.equation[0];
    a = Math.pow(10, result.equation[1]); // Perbaikan rumus a

    document.getElementById("a").value = a.toFixed(4);
    document.getElementById("b").value = b.toFixed(3);
  }

  calculationResults = [];

  csvData.forEach(data => {
    const L = data.length;
    const W_actual = data.weight;
    const W_predicted = a * Math.pow(L, b);
    const K = (W_actual / Math.pow(L, 3)) * 100;

    calculationResults.push({
      length: L,
      weightActual: W_actual,
      weightPredicted: W_predicted,
      conditionFactor: K
    });
  });

  displayLWRResults(a, b);
  renderLWRChart();
  updateResultStatistics();
  showLWRInterpretation();
}

function displayAgeResults() {
  const tableBody = document.querySelector("#resultTable tbody");
  const tableFooter = document.getElementById("tableFooter");
  tableBody.innerHTML = "";

  const displayCount = Math.min(calculationResults.length, 30);

  for (let i = 0; i < displayCount; i++) {
    const result = calculationResults[i];
    const row = document.createElement("tr");
    row.innerHTML = `
          <td>${result.length.toFixed(2)}</td>
          <td>${result.age.toFixed(3)}</td>
          <td>${result.ageMonths.toFixed(1)}</td>
          <td>${result.predictedLength.toFixed(2)}</td>
        `;
    tableBody.appendChild(row);
  }

  if (calculationResults.length > displayCount) {
    tableFooter.style.display = "";
    const paginationCell = tableFooter.querySelector(".pagination-info");
    paginationCell.innerHTML = `Menampilkan ${displayCount} dari ${calculationResults.length} data. Gunakan "Download Hasil" untuk melihat semua data.`;
    paginationCell.setAttribute('colspan', '4');
  } else {
    tableFooter.style.display = "none";
  }

  // Show regression info
  const regressionInfo = document.getElementById("regressionResult");
  try {
    const regressionData = calculationResults.map(r => [r.length, r.predictedLength]);
    const result = regression.linear(regressionData);
    const slope = result.equation[0];
    const intercept = result.equation[1];
    const r2 = result.r2;

    regressionInfo.innerHTML = `
          <div class="info-box">
            <i class="fas fa-chart-line"></i>
            <strong>Hasil Regresi Linear</strong><br>
            Persamaan: y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}<br>
            Koefisien Determinasi (R²) = ${r2.toFixed(4)}
          </div>
        `;
  } catch (error) {
    regressionInfo.innerHTML = `
          <div class="info-box">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Info:</strong> Regresi linear tidak dapat dihitung dengan data ini.
          </div>
        `;
  }
}

function displayLWRResults(a, b) {
  const tableBody = document.querySelector("#resultTable tbody");
  const tableFooter = document.getElementById("tableFooter");
  tableBody.innerHTML = "";

  const displayCount = Math.min(calculationResults.length, 30);

  for (let i = 0; i < displayCount; i++) {
    const result = calculationResults[i];
    const row = document.createElement("tr");
    row.innerHTML = `
          <td>${result.length.toFixed(2)}</td>
          <td>${result.weightActual.toFixed(2)}</td>
          <td>${result.weightPredicted.toFixed(2)}</td>
          <td>${result.conditionFactor.toFixed(2)}</td>
        `;
    tableBody.appendChild(row);
  }

  if (calculationResults.length > displayCount) {
    tableFooter.style.display = "";
    const paginationCell = tableFooter.querySelector(".pagination-info");
    paginationCell.innerHTML = `Menampilkan ${displayCount} dari ${calculationResults.length} data. Gunakan "Download Hasil" untuk melihat semua data.`;
    paginationCell.setAttribute('colspan', '4');
  } else {
    tableFooter.style.display = "none";
  }

  // Calculate and show LWR statistics
  try {
    const actualWeights = calculationResults.map(r => r.weightActual);
    const predictedWeights = calculationResults.map(r => r.weightPredicted);
    const regressionData = actualWeights.map((w, i) => [w, predictedWeights[i]]);
    const result = regression.linear(regressionData);
    const r2 = result.r2;

    const regressionInfo = document.getElementById("regressionResult");
    regressionInfo.innerHTML = `
          <div class="info-box">
            <i class="fas fa-weight-scale"></i>
            <strong>Parameter Hubungan Panjang-Berat</strong><br>
            Parameter a = ${a.toFixed(4)}<br>
            Parameter b = ${b.toFixed(3)}<br>
            Koefisien Determinasi (R²) = ${r2.toFixed(4)}<br>
            <br>
            <strong>Interpretasi Parameter b:</strong><br>
            ${b < 2.5 ? "Pertumbuhan allometrik negatif (lebih memanjang)" :
              b > 3.5 ? "Pertumbuhan allometrik positif (lebih menggemuk)" :
              "Pertumbuhan isometrik (proporsional)"}
          </div>
        `;
  } catch (error) {
    document.getElementById("regressionResult").innerHTML = `
          <div class="info-box">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Parameter Hubungan Panjang-Berat</strong><br>
            Parameter a = ${a.toFixed(4)}<br>
            Parameter b = ${b.toFixed(3)}
          </div>
        `;
  }
}

function renderAgeChart(linf, k) {
  const ctx = document.getElementById("mainChart").getContext("2d");
  if (myChart) {
    myChart.destroy();
  }

  const chartData = calculationResults.map(r => ({
    x: r.ageMonths,
    y: r.length
  }));

  chartData.sort((a, b) => a.x - b.x);

  const maxAge = Math.max(...chartData.map(d => d.x));
  const regressionLine = [];
  for (let ageInMonths = 0; ageInMonths <= maxAge + 12; ageInMonths += 1) {
    const ageInYears = ageInMonths / 12;
    const length = linf * (1 - Math.exp(-k * ageInYears));
    regressionLine.push({
      x: ageInMonths,
      y: length
    });
  }

  myChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Data Panjang vs Usia',
        data: chartData,
        backgroundColor: 'rgba(44, 111, 187, 0.7)',
        pointRadius: 5,
        pointHoverRadius: 7
      }, {
        label: 'Kurva Pertumbuhan Von Bertalanffy',
        data: regressionLine,
        borderColor: 'rgba(220, 53, 69, 0.8)',
        borderWidth: 3,
        fill: false,
        pointRadius: 0,
        showLine: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Usia (bulan)'
          },
          type: 'linear',
          position: 'bottom'
        },
        y: {
          title: {
            display: true,
            text: 'Panjang (cm)'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return `Panjang: ${point.y.toFixed(2)} cm, Usia: ${point.x.toFixed(1)} bulan`;
            }
          }
        }
      }
    }
  });

  document.getElementById("downloadChartBtn").style.display = "block";
}

function renderLWRChart() {
  const ctx = document.getElementById("mainChart").getContext("2d");
  if (myChart) {
    myChart.destroy();
  }

  const scatterData = calculationResults.map(r => ({
    x: r.length,
    y: r.weightActual
  }));

  const regressionData = calculationResults.map(r => ({
    x: r.length,
    y: r.weightPredicted
  }));

  regressionData.sort((a, b) => a.x - b.x);

  myChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Data Aktual (Panjang vs Berat)',
        data: scatterData,
        backgroundColor: 'rgba(44, 111, 187, 0.7)',
        pointRadius: 5,
        pointHoverRadius: 7
      }, {
        label: 'Kurva Prediksi LWR',
        data: regressionData,
        borderColor: 'rgba(220, 53, 69, 0.8)',
        borderWidth: 3,
        fill: false,
        pointRadius: 0,
        showLine: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Panjang (cm)'
          },
          type: 'linear',
          position: 'bottom'
        },
        y: {
          title: {
            display: true,
            text: 'Berat (gram)'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return `Panjang: ${point.x.toFixed(2)} cm, Berat: ${point.y.toFixed(2)} g`;
            }
          }
        }
      }
    }
  });

  document.getElementById("downloadChartBtn").style.display = "block";
}

function updateResultStatistics() {
  if (calculationResults.length === 0) return;

  const statBox = document.getElementById("resultStatBox");

  if (currentMode === 'age') {
    const ageStats = calculateStatistics(calculationResults, 'age');

    statBox.innerHTML = `
          <div class="stat-item">
            <div class="stat-label">Jumlah Sampel</div>
            <div class="stat-value">${ageStats.count}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Usia Minimum</div>
            <div class="stat-value">${ageStats.min.toFixed(3)}</div>
            <div class="stat-label">tahun</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Usia Maksimum</div>
            <div class="stat-value">${ageStats.max.toFixed(3)}</div>
            <div class="stat-label">tahun</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Rata-rata Usia</div>
            <div class="stat-value">${ageStats.avg.toFixed(3)}</div>
            <div class="stat-label">tahun</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Median Usia</div>
            <div class="stat-value">${ageStats.median.toFixed(3)}</div>
            <div class="stat-label">tahun</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Std Deviasi Usia</div>
            <div class="stat-value">${ageStats.stdDev.toFixed(3)}</div>
            <div class="stat-label">tahun</div>
          </div>
        `;

    document.getElementById("result-stat-title").textContent = "Statistik Prediksi Usia";
  } else {
    const conditionStats = calculateStatistics(calculationResults, 'conditionFactor');

    statBox.innerHTML = `
          <div class="stat-item">
            <div class="stat-label">Jumlah Sampel</div>
            <div class="stat-value">${conditionStats.count}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">K Minimum</div>
            <div class="stat-value">${conditionStats.min.toFixed(2)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">K Maksimum</div>
            <div class="stat-value">${conditionStats.max.toFixed(2)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">K Rata-rata</div>
            <div class="stat-value">${conditionStats.avg.toFixed(2)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">K Median</div>
            <div class="stat-value">${conditionStats.median.toFixed(2)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">K Std Deviasi</div>
            <div class="stat-value">${conditionStats.stdDev.toFixed(2)}</div>
          </div>
        `;

    document.getElementById("result-stat-title").textContent = "Statistik Faktor Kondisi";
  }

  document.getElementById("resultsStatsCard").style.display = "block";
}

function getClassification(panjang, species) {
  const rules = classificationRules[species] || classificationRules['default'];

  if (rules) {
    for (const rule of rules) {
      if (panjang >= rule.min && panjang < rule.max) {
        return rule.phase;
      }
    }
  }

  return 'Klasifikasi tidak ditemukan';
}

function showInterpretation() {
  const avgLength = calculationResults.reduce((sum, r) => sum + r.length, 0) / calculationResults.length;
  const avgAge = calculationResults.reduce((sum, r) => sum + r.age, 0) / calculationResults.length;
  const classification = getClassification(avgLength, currentSpecies);

  let interpretationText = `
        Hasil menunjukkan bahwa ukuran rata-rata teripang yang tertangkap adalah sekitar ${avgLength.toFixed(2)} cm. 
        Dengan menggunakan model pertumbuhan Von Bertalanffy, diperkirakan rata-rata usia teripang pada ukuran tersebut 
        adalah ${avgAge.toFixed(2)} tahun. Berdasarkan literatur, kemungkinan besar teripang yang anda tangkap adalah 
        tergolong ${classification}.
      `;

  if (currentSpecies && speciesDatabase[currentSpecies]) {
    const speciesData = speciesDatabase[currentSpecies];
    interpretationText = `
          <strong>Spesies: ${currentSpecies} (${speciesData.commonName})</strong><br>
          ${speciesData.description}<br><br>
          ${interpretationText}
        `;
  }

  document.getElementById("interpretationResult").innerHTML = interpretationText;
  document.getElementById("interpretationCard").style.display = "block";
}

function showLWRInterpretation() {
  const avgCondition = calculationResults.reduce((sum, r) => sum + r.conditionFactor, 0) / calculationResults.length;
  const goodCondition = calculationResults.filter(r => r.conditionFactor >= 1).length;
  const poorCondition = calculationResults.filter(r => r.conditionFactor < 1).length;

  let conditionInterpretation = "";
  if (avgCondition >= 1.2) {
    conditionInterpretation = "sangat baik (well-nourished)";
  } else if (avgCondition >= 1.0) {
    conditionInterpretation = "baik (good condition)";
  } else if (avgCondition >= 0.8) {
    conditionInterpretation = "cukup (fair condition)";
  } else {
    conditionInterpretation = "kurang baik (poor condition)";
  }

  let interpretationText = `
        <strong>Analisis Hubungan Panjang-Berat dan Faktor Kondisi Fulton:</strong><br><br>
        
        <strong>Faktor Kondisi Rata-rata:</strong> ${avgCondition.toFixed(2)}<br>
        Kondisi populasi teripang secara keseluruhan dapat dikategorikan sebagai <strong>${conditionInterpretation}</strong>.<br><br>
        
        <strong>Distribusi Kondisi:</strong><br>
        • Kondisi Baik (K ≥ 1.0): ${goodCondition} individu (${(goodCondition/calculationResults.length*100).toFixed(1)}%)<br>
        • Kondisi Kurang (K < 1.0): ${poorCondition} individu (${(poorCondition/calculationResults.length*100).toFixed(1)}%)<br><br>
        
        <strong>Interpretasi:</strong><br>
        Faktor Kondisi Fulton (K) menunjukkan kesehatan dan kegemukan relatif teripang. 
        Nilai K > 1.0 menandakan kondisi yang baik dengan nutrisi yang cukup, 
        sedangkan K < 1.0 dapat mengindikasikan stres lingkungan atau kekurangan nutrisi.
      `;

  if (currentSpecies && speciesDatabase[currentSpecies]) {
    const speciesData = speciesDatabase[currentSpecies];
    interpretationText = `
          <strong>Spesies: ${currentSpecies} (${speciesData.commonName})</strong><br>
          ${speciesData.description}<br><br>
          ${interpretationText}
        `;
  }

  document.getElementById("interpretationResult").innerHTML = interpretationText;
  document.getElementById("interpretationCard").style.display = "block";
}

function showLoading(show) {
  document.getElementById("loadingIndicator").style.display = show ? "block" : "none";
}

function resetResults() {
  document.querySelector("#resultTable tbody").innerHTML = "";
  document.getElementById("regressionResult").innerHTML = "";
  document.getElementById("resultsStatsCard").style.display = "none";
  document.getElementById("interpretationCard").style.display = "none";
  document.getElementById("downloadChartBtn").style.display = "none";
  document.getElementById("tableFooter").style.display = "none";

  if (myChart) {
    myChart.destroy();
    myChart = null;
  }
}

function resetForm() {
  document.getElementById("linf").value = "30.66";
  document.getElementById("k").value = "0.34";
  document.getElementById("a").value = "";
  document.getElementById("b").value = "";
  document.getElementById("species").value = "";
  document.getElementById("csvInput").value = "";
  document.getElementById("fileName").textContent = "Belum ada file dipilih";

  csvData = [];
  calculationResults = [];
  currentSpecies = null;
  updateStatistics();
  resetResults();
}

function downloadChart() {
  if (!myChart) {
    alert("Tidak ada grafik yang tersedia untuk diunduh!");
    return;
  }

  const canvas = document.getElementById("mainChart");
  const imageLink = document.createElement('a');

  if (currentMode === 'age') {
    imageLink.download = 'visualisasi_pertumbuhan_teripang.png';
  } else {
    imageLink.download = 'hubungan_panjang_berat_teripang.png';
  }

  imageLink.href = canvas.toDataURL('image/png');
  imageLink.click();
}

function downloadCSV() {
  if (calculationResults.length === 0) {
    alert("Tidak ada data untuk diunduh. Silakan hitung analisis terlebih dahulu.");
    return;
  }

  let csvContent = "";
  let filename = "";

  if (currentMode === 'age') {
    csvContent = "Panjang (cm),Usia (tahun),Usia (bulan),Prediksi Lt+1 (cm)\n";
    calculationResults.forEach(result => {
      csvContent += `${result.length.toFixed(2)},${result.age.toFixed(3)},${result.ageMonths.toFixed(1)},${result.predictedLength.toFixed(2)}\n`;
    });
    filename = "prediksi_usia_teripang.csv";
  } else {
    csvContent = "Panjang (cm),Berat Aktual (g),Berat Prediksi (g),Faktor Kondisi (K)\n";
    calculationResults.forEach(result => {
      csvContent += `${result.length.toFixed(2)},${result.weightActual.toFixed(2)},${result.weightPredicted.toFixed(2)},${result.conditionFactor.toFixed(2)}\n`;
    });
    filename = "analisis_lwr_fulton_teripang.csv";
  }
  
} else if (currentMode === 'multispecies') {
  downloadMultispeciesResults();

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}