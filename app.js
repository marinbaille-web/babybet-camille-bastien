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
