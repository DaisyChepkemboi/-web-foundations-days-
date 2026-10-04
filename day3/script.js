let notes = [
    { id: 1, text: "Buy milk and bread", category: "personal" },
    { id: 2, text: "Finish the Day 3 assignment", category: "study" },
    { id: 3, text: "Email the project report to Grace", category: "work" },
    { id: 4, text: "Revise JavaScript arrays", category: "study" },
    { id: 5, text: "Call mum", category: "personal" },
];


// 1. Search Notes
function searchNotes(word) {
    return notes.filter(function (note) {
        return note.text.toLowerCase().includes(word.toLowerCase());
    });
}


// 2. Find Longest Note
function longestNote() {
    if (notes.length === 0) {
        return null;
    }

    return notes.reduce(function (longest, note) {
        if (note.text.length > longest.text.length) {
            return note;
        }

        return longest;
    });
}


// 3. Count Notes By Category
function countByCategory() {
    let counts = {
        personal: 0,
        work: 0,
        study: 0
    };

    notes.forEach(function (note) {
        counts[note.category]++;
    });

    return counts;
}


// 4. Get Summary
function getSummary() {
    let counts = countByCategory();

    return `${notes.length} notes: ${counts.personal} personal, ${counts.work} work, ${counts.study} study.`;
}


// 5. Check For Duplicate
function isDuplicate(text) {
    let cleanedText = text.trim().replace(/\s+/g, " ").toLowerCase();

    return notes.some(function (note) {
        let existingText = note.text
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();

        return existingText === cleanedText;
    });
}


// 6. Add Note
function addNote(text, category) {

    // Remove unnecessary spaces
    let cleanedText = text.trim().replace(/\s+/g, " ");

    // Check length
    if (cleanedText.length < 1 || cleanedText.length > 200) {
        console.log("Note must be between 1 and 200 characters.");
        return false;
    }

    // Check category
    let validCategories = ["personal", "work", "study"];

    if (!validCategories.includes(category)) {
        console.log("Invalid category. Use personal, work or study.");
        return false;
    }

    // Check duplicate
    if (isDuplicate(cleanedText)) {
        console.log("This note already exists.");
        return false;
    }

    // Generate new ID
    let newId = notes.length > 0
        ? Math.max(...notes.map(note => note.id)) + 1
        : 1;

    // Add the note
    notes.push({
        id: newId,
        text: cleanedText,
        category: category
    });

    console.log("Note added successfully.");

    return true;
}


// TESTS

console.log("=== Search Notes ===");

console.log(searchNotes("day"));

console.log(searchNotes("JAVASCRIPT"));


console.log("=== Longest Note ===");

console.log(longestNote());


console.log("=== Count By Category ===");

console.log(countByCategory());


console.log("=== Summary ===");

console.log(getSummary());


console.log("=== Duplicate Check ===");

console.log(isDuplicate("Call mum"));

console.log(isDuplicate("  CALL    MUM  "));

console.log(isDuplicate("Go shopping"));


console.log("=== Add Notes ===");

console.log(addNote("Learn JavaScript functions", "study"));

console.log(addNote("Call mum", "personal"));

console.log(addNote("New note", "invalid"));

console.log(addNote("", "study"));


console.log("=== Notes After Adding ===");

console.log(notes);

console.log("=== Updated Summary ===");

console.log(getSummary());