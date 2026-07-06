const API_URL = window.BABYBET_CONFIG && window.BABYBET_CONFIG.API_URL;

const ODDS = {
  gender: {
    "Garçon": 1.85,
    "Fille": 1.85,
    "Non binaire": 12.0
  },
  weight: {
    "Moins de 3 kg": 3.2,
    "Entre 3 kg et 3,5 kg": 1.9,
    "Plus de 3,5 kg": 2.4
  },
  height: {
    "Moins de 48 cm": 4.0,
    "Entre 48 et 51 cm": 1.75,
    "Plus de 51 cm": 2.8
  },
  eyeColor: {
    "Bleus": 2.1,
    "Verts": 3.4,
    "Marrons": 1.6,
    "Gris / Autre": 8.0
  },
  birthDate: {
    "Avant terme": 3.0,
    "Pile à la date prévue": 2.0,
    "Après terme": 2.5
  },
  hair: {
    "Non": 2.4,
    "Belles boucles de son papa": 1.8,
    "3 poils sur le caillou": 5.0
  }
};

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

    const callbackName =
      "babybetCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

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

/* ----------------------------- */
/* PAGE INDEX — FORMULAIRE PARI */
/* ----------------------------- */

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
      birthTime: "",
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
  setText("preview-date", data.birthDate || "-");
  setText("preview-eyes", data.eyeColor || "-");
  setText("preview-hair", data.hair || "-");

  const totalOdds = calculateTotalOdds(data);
  setText("preview-total-odds", totalOdds ? totalOdds.toFixed(2) : "-");
}

function calculateTotalOdds(data) {
  let total = 1;
  let hasOdd = false;

  ["gender", "weight", "height", "eyeColor", "birthDate", "hair"].forEach(function (key) {
    if (data[key] && ODDS[key] && ODDS[key][data[key]]) {
      total *= ODDS[key][data[key]];
      hasOdd = true;
    }
  });

  return hasOdd ? total : null;
}

/* ----------------------------- */
/* PAGE PARIS — RÉSULTATS */
/* ----------------------------- */

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
          <td colspan="9">${escapeHtml(error.message)}</td>
        </tr>
      `;
    });
}

function renderResults(results) {
  const genderTitle = document.getElementById("gender-result-title");
  const genderBox = document.getElementById("gender-result-box");

  const finalTitle = document.getElementById("final-result-title");
  const finalBox = document.getElementById("final-results-box");

  const scoreCards = document.querySelectorAll(".score-card");
  const genderCard = scoreCards[0];
  const finalCard = scoreCards[1];

  if (genderCard) {
    genderCard.classList.remove("revealed", "result-boy", "result-girl", "result-nb");
  }

  if (finalCard) {
    finalCard.classList.remove("revealed");
  }

  if (genderTitle && genderBox) {
    if (results.genderResult) {
      genderTitle.textContent = "Révélé !";

      if (genderCard) {
        genderCard.classList.add("revealed");

        if (results.genderResult === "Garçon") {
          genderCard.classList.add("result-boy");
        } else if (results.genderResult === "Fille") {
          genderCard.classList.add("result-girl");
        } else {
          genderCard.classList.add("result-nb");
        }
      }

      genderBox.innerHTML = `
        <div class="result-badge">${escapeHtml(results.genderResult)}</div>
        <div class="result-lines">
          <strong>Résultat officiel validé</strong>
          <span>Le premier classement du reveal est maintenant ouvert.</span>
        </div>
      `;
    } else {
      genderTitle.textContent = "En attente";
      genderBox.innerHTML = `Résultat prévu en juillet 2026.`;
    }
  }

  if (finalTitle && finalBox) {
    const hasFinal =
      results.birthDateResult ||
      results.weightResult ||
      results.heightResult ||
      results.eyeColorResult ||
      results.firstNameResult ||
      results.hairResult ||
      results.resemblanceResult;

    if (!hasFinal) {
      finalTitle.textContent = "En attente";
      finalBox.innerHTML = `Terme prévu : 31 décembre 2026.`;
      return;
    }

    finalTitle.textContent = "Résultats validés !";

    if (finalCard) {
      finalCard.classList.add("revealed");
    }

    finalBox.innerHTML = `
      <div class="final-results-list">
        <div><strong>Date :</strong> ${escapeHtml(results.birthDateResult || "-")}</div>
        <div><strong>Poids :</strong> ${escapeHtml(results.weightResult || "-")}</div>
        <div><strong>Taille :</strong> ${escapeHtml(results.heightResult || "-")}</div>
        <div><strong>Yeux :</strong> ${escapeHtml(results.eyeColorResult || "-")}</div>
        <div><strong>Prénom :</strong> ${escapeHtml(results.firstNameResult || "-")}</div>
        <div><strong>Cheveux :</strong> ${escapeHtml(results.hairResult || "-")}</div>
        <div><strong>Ressemblance :</strong> ${escapeHtml(results.resemblanceResult || "-")}</div>
      </div>
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
      ? "Le classement est calculé avec les résultats déjà validés par Camille et Bastien."
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

  if (results.birthDateResult && sameText(bet.birthDate, results.birthDateResult)) {
    points += 15;
    details.push("Date trouvée");
  }

  if (results.weightResult && sameText(bet.weight, results.weightResult)) {
    points += 15;
    details.push("Poids trouvé");
  }

  if (results.heightResult && sameText(bet.height, results.heightResult)) {
    points += 10;
    details.push("Taille trouvée");
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
      normalizeText(bet.firstNameGuess).charAt(0) ===
        normalizeText(results.firstNameResult).charAt(0)
    ) {
      points += 5;
      details.push("Bonne initiale");
    }
  }

  if (results.hairResult && sameText(bet.hair, results.hairResult)) {
    points += 8;
    details.push("Cheveux trouvés");
  }

  return {
    points: points,
    details: details
  };
}

function renderBetsTable(bets) {
  const tableBody = document.getElementById("bets-table-body");
  if (!tableBody) return;

  if (!bets.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9">Aucun pari enregistré pour le moment.</td>
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
          <td>${escapeHtml(bet.birthDate || "-")}</td>
          <td>${escapeHtml(bet.eyeColor || "-")}</td>
          <td>${escapeHtml(bet.firstNameGuess || "-")}</td>
          <td>${escapeHtml(bet.hair || "-")}</td>
          <td>${escapeHtml(bet.resemblance || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

/* ----------------------------- */
/* PAGE ADMIN */
/* ----------------------------- */

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
        birthTimeResult: "",
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
        <strong>Date :</strong> ${escapeHtml(results.birthDateResult || "En attente")}<br>
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

/* ----------------------------- */
/* OUTILS */
/* ----------------------------- */

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
  if (index === 0 && points > 0) return "Champion BabyBet provisoire";
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
