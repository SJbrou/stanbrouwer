---
layout: default
permalink: /me.html
background: #'/assets/img/bike-in-berlin.jpeg'
---
<div id="animated-text-container">
<p id="animated-text">Hi, I'm Stan...</P>
</div>

<script>
document.addEventListener("DOMContentLoaded", function () {
    const textElement = document.getElementById("animated-text");
    const introText = "Hi, I'm Stan...";
    const fullText = `<br><br>Currently studying many things computer science related, and working as a teacher assistant for the school of business and economics at VU university. <br><br>I help multiple companies make sense of their data as a freelancer, and am currently writing my masters' thesis about machine learning and ESG reporting at CapGemini. <br><br>
    In my free time, you'll find me working out in the mornings or discovering new music in the evenings.
    <br><br>Feel free to reach out if you like to chat, need assistance, or want to explore collaboration. I'm available! `;

    let currentText = "";
    let caretVisible = true;
    let index = 0;

    function typeIntroText() {
        if (index < introText.length) {
            currentText += introText[index];
            textElement.innerHTML = currentText + "|"; // Keep caret visible
            index++;
            setTimeout(typeIntroText, 60); // Slow typing speed for intro
        } else {
            setTimeout(removeDots, 1000); // Short pause before removing dots
        }
    }

    function removeDots() {
        if (currentText.endsWith("...")) {
            currentText = currentText.slice(0, -1); // Remove last dot
            textElement.innerHTML = currentText + "|";
            setTimeout(removeDots, 300); // Pause before removing another dot
        } else if (currentText.endsWith("..")) {
            currentText = currentText.slice(0, -1); // Remove second dot
            textElement.innerHTML = currentText + "|";
            setTimeout(removeDots, 300); // Pause before removing another dot
            setTimeout(() => typeText(0, currentText, 45), 700); // Start typing full text
        }
    }

    function typeText(index, currentText, delay) {
        if (index < fullText.length) {
            if (fullText.substring(index, index + 4) === "<br>") {
                currentText += "<br>";
                index += 4;
            } else {
                currentText += fullText[index];
                index++;
            }

            const acceleratedDelay = Math.max(10, delay * 0.90); // Gradually speeds up but never below 20ms
            textElement.innerHTML = currentText + "|"; // Keep caret visible
            setTimeout(() => typeText(index, currentText, acceleratedDelay), acceleratedDelay);
        } else {
            setTimeout(startFinalBlinking, 500); // Start blinking caret at the end
        }
    }

    function startFinalBlinking() {
        setInterval(() => {
            textElement.innerHTML = textElement.innerHTML.endsWith("|") 
                ? textElement.innerHTML.replace("|", "") 
                : textElement.innerHTML + "|";
        }, 500); // Blinks every 500ms
    }

    // Start typing intro text first
    typeIntroText();
});
</script>

<style>
#animated-text-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Ensures text starts at the top */
  justify-content: flex-start;
  width: 100%;
  min-height: 700px; /* Ensures container has enough space */
  box-sizing: border-box;
}

#animated-text {
  width: 100%;
  white-space: normal; /* Allows normal text wrapping */
}

</style>