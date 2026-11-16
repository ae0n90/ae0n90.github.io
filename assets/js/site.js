(function () {
  const button = document.querySelector("[data-pronunciation-button]");
  const audio = document.querySelector("[data-pronunciation-audio]");

  if (!button) {
    return;
  }

  const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  if (!audio && !canSpeak) {
    button.disabled = true;
    button.title = "Audio pronunciation is not supported in this browser";
    return;
  }

  function chooseVoice() {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => /^zh/i.test(voice.lang)) || null;
  }

  function speakWithSynthesis() {
    if (!canSpeak) {
      return;
    }

    window.speechSynthesis.cancel();

    const voice = chooseVoice();
    const utterance = new SpeechSynthesisUtterance(voice ? "周晓时" : "Joe Shyow Shrr");
    utterance.lang = voice ? voice.lang : "en-US";
    utterance.rate = voice ? 0.82 : 0.78;

    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }

  function playName() {
    if (!audio) {
      speakWithSynthesis();
      return;
    }

    audio.currentTime = 0;
    audio.play().catch(speakWithSynthesis);
  }

  if (canSpeak) {
    window.speechSynthesis.addEventListener("voiceschanged", chooseVoice);
  }

  button.addEventListener("click", playName);
})();

// Home "Recent": lists items marked with data-date on the source pages that fall within the last N months.
(function () {
  const section = document.querySelector("[data-recent]");

  if (!section || !window.fetch || !window.DOMParser) {
    return;
  }

  const list = section.querySelector("ol");
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Number(section.dataset.months || 3));
  cutoff.setHours(0, 0, 0, 0);

  function collect(source) {
    return fetch(source)
      .then((response) => (response.ok ? response.text() : ""))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return Array.from(doc.querySelectorAll("[data-date]")).map((item) => {
          const group = item.closest("[data-kind]");
          return {
            date: new Date(item.dataset.date + "T00:00:00"),
            label: item.dataset.date.slice(0, 7).replace("-", "."),
            kind: group ? group.dataset.kind : "",
            href: source + (group && group.dataset.anchor ? "#" + group.dataset.anchor : ""),
            item: item,
          };
        });
      })
      .catch(() => []);
  }

  function render(entry) {
    const li = document.createElement("li");
    const time = document.createElement("time");
    const body = document.createElement("div");
    const heading = entry.item.querySelector("h3");

    time.textContent = entry.kind ? entry.label + " \u00b7 " + entry.kind : entry.label;

    if (heading) {
      const title = document.createElement("h3");
      const link = document.createElement("a");
      link.href = entry.href;
      link.textContent = heading.textContent;
      title.appendChild(link);
      body.appendChild(title);
      entry.item.querySelectorAll("p").forEach((p) => body.appendChild(document.importNode(p, true)));
    } else {
      const text = document.createElement("p");
      Array.from(entry.item.childNodes).forEach((node) => text.appendChild(document.importNode(node, true)));
      body.appendChild(text);
    }

    li.append(time, body);
    return li;
  }

  Promise.all(section.dataset.sources.split(/\s+/).filter(Boolean).map(collect)).then((groups) => {
    const recent = groups
      .flat()
      .filter((entry) => !isNaN(entry.date) && entry.date >= cutoff)
      .sort((a, b) => b.date - a.date);

    if (!recent.length) {
      return;
    }

    recent.forEach((entry) => list.appendChild(render(entry)));
    section.hidden = false;
  });
})();
