const API_URL = window.BABYBET_CONFIG && window.BABYBET_CONFIG.API_URL;

document.addEventListener("DOMContentLoaded", function () {
  initBetForm();
  initParisPage();
  initAdminPage();
});

function callApi(params) {
  return new Promise(function (resolve, reject) {
    if (!API_URL || API_URL.includes("COLLE_ICI")) {
      reject(new Error("URL Apps Script manquante dans config.js"));
      return;
    }

    const callbackName = "babybetCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

    params.callback = callbackName;

    const query = Object.keys(params)
      .map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key] || "");
      })
      .join("&");

    const script = document.createElement("script");
    const timeout = setTimeout(function () {
      cleanup();
      reject(new Error("Temps de réponse dépassé. Réessaie."));
    }, 15000);

    window[callbackName] = function (data) {
      cleanup();
      if (data && data.ok) {
        resolve(data);
      } else {
        reject(new Error((data && data.error) || "Erreur inconnue."));
      }
    };

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    script.src = API_URL + "?" + query;
    script.onerror = function () {
      cleanup();
      reject(new Error("Impossible de contacter Google Sheets."));
    };

    document.body.appendChild(script);
  });
}

function initBetForm() {
  const form = document.getElementById("bet-form");
  if (!form) return;

  const message = document.getElementById("form-message");

  form.addEventListener("input", updateTicketPreview);
  form.addEventListener("change", updateTicketPreview);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const data = formToObject(form);
    const button = form.querySelector("button[type='submit']");

    setMessage(message, "Enregistrement du ticket...", "");
    button.disabled = true;

    callApi({
      action: "submitBet",
      bettorName: data.bettorName,
      gender: data.gender,
      weight: data.weight,
      height: data.height,
      birthDate: data.birthDate,
      birthTime: data.birthTime,
      eyeColor: data.eyeColor,
      firstNameGuess: data.firstNameGuess,
      hair: data.hair,
      resemblance: data.resemblance
    })
      .then(function () {
        setMessage(
          message,
          "Ticket validé 🎟️ Redirection vers les paris des autres...",
          "success"
        );

        form.reset();
        updateTicketPreview();

        setTimeout(function () {
          window.location.href = "paris.html";
        }, 1200);
      })
      .catch(function (error) {
        setMessage(message, error.message, "error");
      })
      .finally(function () {
        button.disabled = false;
      });
  });

  updateTicketPreview();
}

function updateTicketPreview() {
  const form = document.getElementById("bet-form");
  if (!form) return;

  const data = formToObject(form);

  setText("preview-bettor", data.bettorName || "-");
  setText("preview-gender", data.gender || "-");
  setText("preview-weight", data.weight || "-");
  setText("preview-height", data.height || "-");
  setText("preview-date", formatDate(data.birthDate) || "-");
  setText("preview-eyes", data.eyeColor || "-");
}

function initParisPage() {
  const tableBody = document.getElementById("bets-table-body");
  if (!tableBody) return;

  callApi({ action: "getData" })
    .then(function (data) {
      const bets = data.bets || [];
      const results = data.results || {};

      renderResults(results);
      renderRanking(bets, results);
      renderBetsTable(bets);
    })
    .catch(function (error) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10">${escapeHtml(error.message)}</td>
        </tr>
      `;
    });
}

function renderResults(results) {
  const genderBox = document.getElementById("gender-result-box");
  const finalBox = document.getElementById("final-results-box");

  if (genderBox) {
    if (results.genderResult) {
      genderBox.innerHTML = `
        <strong>Résultat officiel :</strong> ${escapeHtml(results.genderResult)}
        <br>
        Le premier classement du reveal est ouvert.
      `;
    } else {
      genderBox.textContent = "En attente du reveal de juillet 2026.";
    }
  }

  if (finalBox) {
    const hasFinal =
      results.birthDateResult ||
      results.birthTimeResult ||
      results.weightResult ||
      results.heightResult ||
      results.eyeColorResult ||
      results.firstNameResult ||
      results.hairResult ||
      results.resemblanceResult;

    if (!hasFinal) {
      finalBox.textContent = "En attente du coup de sifflet final.";
      return;
    }

    finalBox.innerHTML = `
      <strong>Date :</strong> ${escapeHtml(formatDate(results.birthDateResult) || "-")}<br>
      <strong>Heure :</strong> ${escapeHtml(results.birthTimeResult || "-")}<br>
      <strong>Poids :</strong> ${escapeHtml(results.weightResult || "-")}<br>
      <strong>Taille :</strong> ${escapeHtml(results.heightResult || "-")}<br>
      <strong>Yeux :</strong> ${escapeHtml(results.eyeColorResult || "-")}<br>
      <strong>Prénom :</strong> ${escapeHtml(results.firstNameResult || "-")}<br>
      <strong>Cheveux :</strong> ${escapeHtml(results.hairResult || "-")}<br>
      <strong>Ressemblance :</strong> ${escapeHtml(results.resemblanceResult || "-")}
    `;
  }
}

function renderRanking(bets, results) {
  const rankingList = document.getElementById("ranking-list");
  const rankingIntro = document.getElementById("ranking-intro");
  if (!rankingList) return;

  if (!bets.length) {
    rankingList.innerHTML = `
      <div class="status-box">Aucun pari enregistré pour le moment.</div>
    `;
    return;
  }

  const hasAnyResult =
    results.genderResult ||
    results.birthDateResult ||
    results.birthTimeResult ||
    results.weightResult ||
    results.heightResult ||
    results.eyeColorResult ||
    results.firstNameResult ||
    results.hairResult;

  const ranked = bets
    .map(function (bet) {
      const score = calculateScore(bet, results);
      return {
        name: bet.bettorName || "Parieur mystère",
        points: score.points,
        details: score.details
      };
    })
    .sort(function (a, b) {
      return b.points - a.points;
    });

  if (rankingIntro) {
    rankingIntro.textContent = hasAnyResult
      ? "Le classement est calculé avec les résultats déjà validés par les parents."
      : "Aucun résultat officiel pour le moment : tout le monde est encore en lice.";
  }

  rankingList.innerHTML = ranked
    .map(function (item, index) {
      const badge = getBadge(index, item.points, hasAnyResult);
      const details = item.details.length
        ? item.details.join(" · ")
        : "En attente des résultats officiels";

      return `
        <div class="ranking-item">
          <div class="rank-number">${index + 1}</div>
          <div>
            <div class="rank-name">${escapeHtml(item.name)}</div>
            <div class="rank-details">${escapeHtml(badge)} · ${escapeHtml(details)}</div>
          </div>
          <div class="rank-points">${item.points} pts</div>
        </div>
      `;
    })
    .join("");
}

function calculateScore(bet, results) {
  let points = 0;
  const details = [];

  if (results.genderResult && sameText(bet.gender, results.genderResult)) {
    points += 20;
    details.push("Sexe trouvé");
  }

  if (results.birthDateResult && bet.birthDate) {
    const diff = dateDiffInDays(bet.birthDate, results.birthDateResult);

    if (diff === 0) {
      points += 25;
      details.push("Date exacte");
    } else if (diff !== null && diff <= 3) {
      points += 10;
      details.push("Date proche");
    }
  }

  if (results.birthTimeResult && bet.birthTime) {
    const diffMinutes = timeDiffInMinutes(bet.birthTime, results.birthTimeResult);

    if (diffMinutes === 0) {
      points += 15;
      details.push("Heure exacte");
    } else if (diffMinutes !== null && diffMinutes <= 60) {
      points += 8;
      details.push("Heure proche");
    }
  }

  if (results.weightResult && bet.weight) {
    const betWeight = parseNumber(bet.weight);
    const resultWeight = parseNumber(results.weightResult);

    if (betWeight !== null && resultWeight !== null) {
      const diff = Math.abs(betWeight - resultWeight);

      if (diff <= 0.05) {
        points += 15;
        details.push("Poids quasi exact");
      } else if (diff <= 0.2) {
        points += 8;
        details.push("Poids proche");
      }
    }
  }

  if (results.heightResult && bet.height) {
    const betHeight = parseNumber(bet.height);
    const resultHeight = parseNumber(results.heightResult);

    if (betHeight !== null && resultHeight !== null) {
      const diff = Math.abs(betHeight - resultHeight);

      if (diff <= 1) {
        points += 10;
        details.push("Taille proche");
      } else if (diff <= 3) {
        points += 5;
        details.push("Taille pas loin");
      }
    }
  }

  if (results.eyeColorResult && sameText(bet.eyeColor, results.eyeColorResult)) {
    points += 8;
    details.push("Yeux trouvés");
  }

  if (results.firstNameResult && bet.firstNameGuess) {
    if (sameText(bet.firstNameGuess, results.firstNameResult)) {
      points += 30;
      details.push("Prénom exact");
    } else if (
      normalizeText(bet.firstNameGuess).charAt(0) &&
      normalizeText(bet.firstNameGuess).charAt(0) === normalizeText(results.firstNameResult).charAt(0)
    ) {
      points += 5;
      details.push("Bonne initiale");
    }
  }

  if (results.hairResult && sameText(bet.hair, results.hairResult)) {
    points += 8;
    details.push("Cheveux trouvés");
  }

  return { points: points, details: details };
}

function renderBetsTable(bets) {
  const tableBody = document.getElementById("bets-table-body");
  if (!tableBody) return;

  if (!bets.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10">Aucun pari enregistré pour le moment.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = bets
    .map(function (bet) {
      return `
        <tr>
          <td>${escapeHtml(bet.bettorName || "-")}</td>
          <td>${escapeHtml(bet.gender || "-")}</td>
          <td>${escapeHtml(bet.weight || "-")}</td>
          <td>${escapeHtml(bet.height || "-")}</td>
          <td>${escapeHtml(formatDate(bet.birthDate) || "-")}</td>
          <td>${escapeHtml(bet.birthTime || "-")}</td>
          <td>${escapeHtml(bet.eyeColor || "-")}</td>
          <td>${escapeHtml(bet.firstNameGuess || "-")}</td>
          <td>${escapeHtml(bet.hair || "-")}</td>
          <td>${escapeHtml(bet.resemblance || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

function initAdminPage() {
  const genderForm = document.getElementById("gender-result-form");
  const finalForm = document.getElementById("final-results-form");

  if (!genderForm && !finalForm) return;

  loadAdminCurrentResults();

  if (genderForm) {
    genderForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const data = formToObject(genderForm);
      const message = document.getElementById("gender-admin-message");
      const button = genderForm.querySelector("button[type='submit']");

      setMessage(message, "Enregistrement du reveal...", "");
      button.disabled = true;

      callApi({
        action: "updateGenderResult",
        adminCode: data.adminCode,
        genderResult: data.genderResult
      })
        .then(function () {
          setMessage(message, "Résultat du reveal enregistré ✅", "success");
          loadAdminCurrentResults();
        })
        .catch(function (error) {
          setMessage(message, error.message, "error");
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }

  if (finalForm) {
    finalForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const data = formToObject(finalForm);
      const message = document.getElementById("final-admin-message");
      const button = finalForm.querySelector("button[type='submit']");

      setMessage(message, "Enregistrement des résultats finaux...", "");
      button.disabled = true;

      callApi({
        action: "updateFinalResults",
        adminCode: data.adminCode,
        birthDateResult: data.birthDateResult,
        birthTimeResult: data.birthTimeResult,
        weightResult: data.weightResult,
        heightResult: data.heightResult,
        eyeColorResult: data.eyeColorResult,
        firstNameResult: data.firstNameResult,
        hairResult: data.hairResult,
        resemblanceResult: data.resemblanceResult
      })
        .then(function () {
          setMessage(message, "Résultats finaux enregistrés ✅", "success");
          loadAdminCurrentResults();
        })
        .catch(function (error) {
          setMessage(message, error.message, "error");
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }
}

function loadAdminCurrentResults() {
  const box = document.getElementById("admin-current-results");
  if (!box) return;

  callApi({ action: "getData" })
    .then(function (data) {
      const results = data.results || {};

      box.innerHTML = `
        <strong>Sexe :</strong> ${escapeHtml(results.genderResult || "En attente")}<br>
        <strong>Date :</strong> ${escapeHtml(formatDate(results.birthDateResult) || "En attente")}<br>
        <strong>Heure :</strong> ${escapeHtml(results.birthTimeResult || "En attente")}<br>
        <strong>Poids :</strong> ${escapeHtml(results.weightResult || "En attente")}<br>
        <strong>Taille :</strong> ${escapeHtml(results.heightResult || "En attente")}<br>
        <strong>Yeux :</strong> ${escapeHtml(results.eyeColorResult || "En attente")}<br>
        <strong>Prénom :</strong> ${escapeHtml(results.firstNameResult || "En attente")}<br>
        <strong>Cheveux :</strong> ${escapeHtml(results.hairResult || "En attente")}<br>
        <strong>Ressemblance :</strong> ${escapeHtml(results.resemblanceResult || "En attente")}
      `;
    })
    .catch(function (error) {
      box.textContent = error.message;
    });
}

function formToObject(form) {
  const data = new FormData(form);
  const object = {};

  data.forEach(function (value, key) {
    object[key] = value;
  });

  return object;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setMessage(element, text, type) {
  if (!element) return;

  element.textContent = text;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}

function getBadge(index, points, hasAnyResult) {
  if (!hasAnyResult) return "En attente de la VAR";
  if (index === 0 && points > 0) return "Champion provisoire";
  if (points >= 60) return "Légende du pronostic";
  if (points >= 35) return "Très gros flair";
  if (points > 0) return "Encore dans le match";
  return "Mauvaise foi autorisée";
}

function sameText(a, b) {
  return normalizeText(a) === normalizeText(b);
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseNumber(value) {
  const cleaned = String(value || "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!cleaned) return null;

  const number = Number(cleaned);
  return Number.isNaN(number) ? null : number;
}

function dateDiffInDays(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);

  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return null;
  }

  const oneDay = 1000 * 60 * 60 * 24;
  return Math.round(Math.abs(a - b) / oneDay);
}

function timeDiffInMinutes(timeA, timeB) {
  if (!timeA || !timeB) return null;

  const partsA = String(timeA).split(":");
  const partsB = String(timeB).split(":");

  if (partsA.length < 2 || partsB.length < 2) return null;

  const minutesA = Number(partsA[0]) * 60 + Number(partsA[1]);
  const minutesB = Number(partsB[0]) * 60 + Number(partsB[1]);

  if (Number.isNaN(minutesA) || Number.isNaN(minutesB)) return null;

  return Math.abs(minutesA - minutesB);
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
