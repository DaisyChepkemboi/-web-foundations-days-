
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

const MAX_CHARACTERS = 200;

function updateCounts() {
    const text = noteText.value;
    const characters = text.length;

    const trimmedText = text.trim();
    const words = trimmedText === ""
        ? 0
        : trimmedText.split(/\s+/).length;

    charCount.textContent = `${characters} / ${MAX_CHARACTERS} characters`;
    wordCount.textContent = `${words} words`;

    charCount.classList.remove("warning", "over");

    if (characters > MAX_CHARACTERS) {
        charCount.classList.add("over");
    } else if (characters > 180) {
        charCount.classList.add("warning");
    }
}

function saveDraft() {
    localStorage.setItem("quickNotesDraft", noteText.value);
}

function clearNote() {
    noteText.value = "";
    localStorage.removeItem("quickNotesDraft");
    updateCounts();
}

function applyTheme(isDark) {
    document.body.classList.toggle("dark", isDark);

    themeToggle.textContent = isDark
        ? "Light mode"
        : "Dark mode";
}

noteText.addEventListener("input", function () {
    updateCounts();
    saveDraft();
});

clearBtn.addEventListener("click", clearNote);

noteText.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        clearNote();
    }
});

themeToggle.addEventListener("click", function () {
    const isDark = !document.body.classList.contains("dark");

    applyTheme(isDark);

    localStorage.setItem("quickNotesTheme", isDark ? "dark" : "light");
});

function initialize() {
    const savedDraft = localStorage.getItem("quickNotesDraft");
    const savedTheme = localStorage.getItem("quickNotesTheme");

    if (savedDraft !== null) {
        noteText.value = savedDraft;
    }

    applyTheme(savedTheme === "dark");

    updateCounts();
}

initialize();
