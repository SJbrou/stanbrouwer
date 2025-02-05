---
layout: page
title: 
description: 
permalink: /me.html
background: #'/assets/img/bike-in-berlin.jpeg'
---

<p id="animated-text">Hi, I'm Stan...</P>

<script>
document.addEventListener("DOMContentLoaded", function () {
    const textElement = document.getElementById("animated-text");
    const introText = "Hi, I'm Stan...";
    const fullText = `<br><br>Currently studying Information Science and a bunch of other things at the VU.<br><br>
When I'm not studying, I'm either working as a teacher assistant at the VU, or helping companies make sense of their data.<br><br>
My current projects focus on applied machine learning, consumer analytics, business intelligence, and ESG reporting for various organizations.<br><br>
Please feel free to contact me if there is anything I can help with, or you'd just like to chat. I'm available.`;

    let currentText = "";
    let caretVisible = true;
    let index = 0;

    function typeIntroText() {
        if (index < introText.length) {
            currentText += introText[index];
            textElement.innerHTML = currentText + "|"; // Keep caret visible
            index++;
            setTimeout(typeIntroText, 100); // Slow typing speed for intro
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
            setTimeout(() => typeText(0, currentText, 60), 500); // Start typing full text
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

            const acceleratedDelay = Math.max(10, delay * 0.95); // Gradually speeds up but never below 20ms
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
