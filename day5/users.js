
const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

const API_URL = "https://jsonplaceholder.typicode.com/users";

let users = [];
let hasLoadedUsers = false;

async function loadUsers() {
    loadButton.disabled = true;
    statusMessage.textContent = "Loading users...";
    usersList.replaceChildren();
    hasLoadedUsers = false;

    try {
        const response = await fetch(API_URL);

        // fetch does not automatically reject HTTP errors such as 404.
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("The API returned an unexpected response.");
        }

        users = data;
        hasLoadedUsers = true;

        renderUsers(users);
        statusMessage.textContent = `Successfully loaded ${users.length} users.`;
    } catch (error) {
        users = [];
        hasLoadedUsers = false;
        usersList.replaceChildren();
        statusMessage.textContent =
            "Unable to load users. Please check your connection and try again.";

        console.error("Error loading users:", error);
    } finally {
        loadButton.disabled = false;
    }
}

function renderUsers(list) {
    usersList.replaceChildren();

    if (list.length === 0) {
        const message = document.createElement("li");
        message.textContent = "No users match your filter.";
        usersList.appendChild(message);
        return;
    }

    list.forEach(function (user) {
        const listItem = document.createElement("li");
        listItem.classList.add("user-card");

        const name = document.createElement("h3");
        name.textContent = user.name;

        const email = document.createElement("p");
        email.textContent = `Email: ${user.email}`;

        const city = document.createElement("p");
        city.textContent = `City: ${user.address.city}`;

        const company = document.createElement("p");
        company.textContent = `Company: ${user.company.name}`;

        listItem.appendChild(name);
        listItem.appendChild(email);
        listItem.appendChild(city);
        listItem.appendChild(company);

        usersList.appendChild(listItem);
    });
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", function () {
    if (!hasLoadedUsers) {
        return;
    }

    const searchTerm = filterInput.value.trim().toLowerCase();

    const filteredUsers = users.filter(function (user) {
        return user.name.toLowerCase().includes(searchTerm);
    });

    renderUsers(filteredUsers);
});
