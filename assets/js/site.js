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
