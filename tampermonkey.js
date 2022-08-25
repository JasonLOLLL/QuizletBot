// ==UserScript==
// @name         QuizletBot
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Automatically answer match and learn!
// @author       jasonjat
// @match        https://quizlet.com/*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

const href = window.location.href;
const homePageCheckingElement = "StudyModesNavItem";
const minimumMatchTime = 5;
const learnTime = 1;
const homePageButtonClass = "StudyModesNavItemName";
const learnPageTextClass = "FormattedText notranslate FormattedTextWithImage-wrapper";

const iWasCorrectButtonClass = "AssemblyLink AssemblyLink--small AssemblyLink--primary";
const answerButtonClass = "AssemblyButtonBase AssemblyPrimaryButton--default AssemblyButtonBase--medium AssemblyButtonBase--padding";

const modalElement = '<div role="dialog" aria-modal="true" class="UIModal UIModal-container is-white is-open" tabindex="-1" data-testid="modal-container"><div class="UIModal-box"><button type="button" id="exit-modal-button" style="float:right; margin: 1rem; z-index:1000; position: relative" aria-label="Exit modal" class="AssemblyButtonBase AssemblyIconButton AssemblyIconButton--secondary AssemblyIconButton--square AssemblyButtonBase--medium AssemblyButtonBase--square" title="Back to set page"><svg aria-label="Back to set page" class="AssemblyIcon AssemblyIcon--medium-deprecated" role="img"><noscript></noscript><use xlink:href="#x"></use><noscript></noscript></svg></button><div class="UIModalBody"><div class="MatchModeInstructionsModal MatchModeInstructionsModal--normal"><h3 class="UIHeading UIHeading--three"><span>Quizletbot Options</span></h3><div class="UIDiv MatchModeInstructionsModal-description"><p class="UIParagraph"></p><div>Enter amount of time for match</div><input type="number" placeholder="time" value="10" style="width:5rem" id="time-textbox" min="5"><span> seconds</span><p></p></div><br><div><b>IMPORTANT: FOR MATCH MAKE SURE TO MAKE YOUR BROWSER WINDOW SMALL OR IT WON\'T WORK.</b></div><span class="MatchModeInstructionsModal-button"><button aria-label="Start Match" class="UIButton UIButton--hero" type="button" style="margin-right: 0.1rem" id="match-button"><span class="UIButton-wrapper"><span>Start Match</span></span></button></span><span class="MatchModeInstructionsModal-button"><button aria-label="Start Learn" class="UIButton UIButton--hero" type="button" id="learn-button" style="float:right"><span class="UIButton-wrapper"><span>Start Learn</span></span></button></span><span class="MatchModeInstructionsModal-button"><button aria-label="Start Both" class="UIButton UIButton--hero" type="button" id="both-button" style="width:100%; margin-top:0.3rem"><span class="UIButton-wrapper"><span>Start Both</span></span></button></span></div></div></div></div>';

window.addEventListener("load", function (event) {

    'use strict';

    if (href.includes("quizlet.com")) {
        if (href.endsWith("match")) { // matching game
            match();
        } else if (href.endsWith("learn")) { // learning game
            learn();
        } else if (isHomePage()) { // modal popup
            clearStorage();
            insertModal();
        } else if (href.endsWith("study-path")) { // personalization menu
            Array.from(document.getElementsByTagName("button")).forEach(b => {
                if (b.ariaLabel === "Skip personalization") b.click();
            });
        }
    }
});

function insertModal() {
    const div = document.createElement("div");
    div.innerHTML = modalElement;
    document.body.appendChild(div);

    const timeBox = document.getElementById("time-textbox");
    timeBox.setAttribute("min", minimumMatchTime); // set minimum time to 5.5 seconds

    getAnswers();
    document.getElementById("match-button").addEventListener("click", () => matchClick(timeBox.value, false)); //anon func to pass parameter
    document.getElementById("learn-button").addEventListener("click", learnClick);
    document.getElementById("both-button").addEventListener("click", () => matchClick(timeBox.value, true)); // pass here with both parameter
    document.getElementById("exit-modal-button").addEventListener("click", () => div.remove());
}

function matchClick(timeInSeconds, both) {
    getAnswers();
    localStorage.setItem("matchTime", timeInSeconds < 0 ? minimumMatchTime : timeInSeconds); //store time inside of localStorage (in browser)

    localStorage.setItem("both", both);

    const reference = document.getElementsByClassName(homePageButtonClass)[3].href;
    location.href = reference;
}

function learnClick() {
    getAnswers();
    const reference = document.getElementsByClassName(homePageButtonClass)[1].href;
    location.href = reference;
}


const timer = ms => new Promise(res => setTimeout(res, ms))
async function match() {
    document.querySelector("body > div.UIModal.UIModal-container.is-white.is-open > div > div > div > div.MatchModeInstructionsModal-button > button").click();
    let matchCards = Array.from(document.getElementsByClassName("MatchModeQuestionGridTile-content")).map((x) => x.firstChild.firstChild);
    const wordToDefinition = JSON.parse(localStorage.getItem("wordToDefinition"));
    const definitionToWord = JSON.parse(localStorage.getItem("definitionToWord"));
    const perCardMatchTime = (localStorage.getItem("matchTime") / matchCards.length) * 1000 * 2; // times two to avoid having to call await twice below to account for sets being clicked instantly

    if (wordToDefinition == null || definitionToWord == null || perCardMatchTime == null) {
        alert("Error. Please try again.");
        return;
    }

    let finishedCards = [];

    let d = false;
    for (let m of matchCards) {
        if (finishedCards.includes(m.innerHTML)) continue;

        await timer(perCardMatchTime);
        triggerMousePointer(m.parentElement.parentElement.parentElement); //third parent is the pointerdown listener

        const answer = wordToDefinition[m.innerHTML] || definitionToWord[m.innerHTML];

        if (answer != null) {
            triggerMousePointer(findCard(answer).parentElement.parentElement.parentElement);
            finishedCards.push(answer);
        } else {
            console.warn("error code 1");
        }

        finishedCards.push(m.innerHTML);
        d = true;
    }

    if (matchCards.length == 0) {
        alert("Screen not resized. Please resize your window smaller and refresh.");
    }

    function findCard(card) {
        for (let m of matchCards) {
            if (m.innerHTML === card) return m;
        }
    }

    if (finishedCards.length == matchCards.length && d) {
        redirectToLearnFromMatch()
    };
}

function redirectToLearnFromMatch() {
    if (localStorage.getItem("both") === "true") { // if both, then redirect to learn
        const reference = location.href.replace("match", "learn");
        location.href = reference;
    }
}

async function learn() {
    const wordToDefinition = JSON.parse(localStorage.getItem("wordToDefinition"));
    const definitionToWord = JSON.parse(localStorage.getItem("definitionToWord"));

    aLoop:
    while (true) {
        await timer(learnTime * 1000);
        const inputBox = document.getElementsByClassName("AssemblyInput-input")[0];
        const allButtons = document.getElementsByTagName("button");


        for (let b of allButtons) {
            if (b.ariaLabel === "Skip" || b.ariaLabel.includes("Continue")) { // stupid popup
                b.click();
                continue aLoop;
            } else if (b.ariaLabel === "Finish Learn") { //DONE!
                b.click();
                console.log("job done!")
                break aLoop;
            }
        }

        if (inputBox == null) { // multiple choice
            const questions = document.getElementsByClassName(learnPageTextClass);
            const givenQuestion = questions[0].firstChild; //first child bc it is embedded in a div unlike the MC choices
            const answer = wordToDefinition[givenQuestion.innerHTML] || definitionToWord[givenQuestion.innerHTML];

            for (let w of questions) {
                if (w.innerHTML === answer) {
                    w.parentElement.parentElement.parentElement.click();
                }
            }
        } else { // input question
            const inputElement = document.getElementsByClassName("AssemblyInput-input")[0];
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; // hacky way to go around React input form
            nativeInputValueSetter.call(inputElement, "balls");
            const ev = new Event("input", { bubbles: true }); // send input event to trigger React onChange() so the value is internally updated
            inputElement.dispatchEvent(ev);

            document.getElementsByClassName(answerButtonClass)[0].click();

            const cButton = await waitForElm(".AssemblyLink.AssemblyLink--small.AssemblyLink--primary");
            cButton.click();
        }
    }
}

function getAnswers() {
    const cards = document.getElementsByClassName('TermText notranslate');

    let words = []
    let definitions = []

    for (let c of cards) {
        if (c.parentElement.className === "SetPageTerm-wordText") {
            words.push(c.innerHTML);
        } else if (c.parentElement.className === "SetPageTerm-definitionText") {
            definitions.push(c.innerHTML);
        }
    }

    let wordToDefinition = {};
    let definitionToWord = {};

    for (let i = 0; i < words.length; i++) {
        wordToDefinition[words[i]] = definitions[i];
        definitionToWord[definitions[i]] = words[i];
    }

    localStorage.setItem("wordToDefinition", JSON.stringify(wordToDefinition));
    localStorage.setItem("definitionToWord", JSON.stringify(definitionToWord));
}


function isHomePage() {
    return document.getElementsByClassName(homePageCheckingElement).length > 0;
}

function clearStorage() {
    localStorage.removeItem("matchTime");
    localStorage.removeItem("wordToDefinition");
    localStorage.removeItem("definitionToWord");
    localStorage.removeItem("both");
}

function triggerMousePointer(element) {
    if (element != null) {
        var pointEvent = new PointerEvent("pointerdown");
        element.dispatchEvent(pointEvent);
    }
}

function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}
