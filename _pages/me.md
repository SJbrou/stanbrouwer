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
    const fullText = `<br><br>During the week I'm either a Data Engineer for the governmentor or teaching at the VU. In the weekends, I'm a CrossFit enjoyer and helping with the organisation of large events. 

    My current hobby projects include detecting local misinformation campaings and analysing hyrox performance data.

    <br><br>Feel free to reach out if you like to chat or want to explore collaboration. I'm available! `;

    let currentText = "";
    let caretVisible = true;
    let index = 0;
    let animationIntervals = [];

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
        const blinkInterval = setInterval(() => {
            textElement.innerHTML = textElement.innerHTML.endsWith("|") 
                ? textElement.innerHTML.replace("|", "") 
                : textElement.innerHTML + "|";
        }, 500); // Blinks every 500ms
        animationIntervals.push(blinkInterval);
    }

    function deleteText(href) {
        // Clear all animation intervals
        animationIntervals.forEach(interval => clearInterval(interval));
        animationIntervals = [];

        // Remove the caret if present
        if (textElement.innerHTML.endsWith("|")) {
            currentText = textElement.innerHTML.slice(0, -1);
        } else {
            currentText = textElement.innerHTML;
        }

        const initialLength = currentText.length;
        const halfwayPoint = Math.ceil(initialLength / 2);
        let hasNavigated = false;

        function deleteChar() {
            if (currentText.length > 0) {
                // Handle HTML tags - if we end with >, find the start of the tag and remove it all
                if (currentText.endsWith(">")) {
                    let tagStart = currentText.lastIndexOf("<");
                    if (tagStart !== -1) {
                        currentText = currentText.slice(0, tagStart);
                    } else {
                        currentText = currentText.slice(0, -1);
                    }
                } else {
                    currentText = currentText.slice(0, -1);
                }
                textElement.innerHTML = currentText + "|";

                // Check if we've reached halfway and navigate
                if (!hasNavigated && currentText.length <= halfwayPoint) {
                    hasNavigated = true;
                    window.location.href = href;
                }

                setTimeout(deleteChar, 2); // Fast deletion speed
            } else {
                textElement.innerHTML = "";
            }
        }

        deleteChar();
    }

    // Intercept all link clicks
    document.addEventListener("click", function (e) {
        const link = e.target.closest("a");
        if (link && link.href && !link.href.includes("javascript:")) {
            // Check if it's an internal link (not an anchor link)
            const href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !href.includes(window.location.hostname === "localhost" ? "" : "external")) {
                e.preventDefault();
                deleteText(href);
            }
        }
    });

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