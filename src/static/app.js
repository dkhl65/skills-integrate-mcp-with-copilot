document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const authStatus = document.getElementById("auth-status");
  const messageDiv = document.getElementById("message");
  const emailInput = document.getElementById("email");

  let token = localStorage.getItem("authToken") || "";
  let currentUser = null;

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    if (!currentUser) {
      authStatus.textContent = "Not logged in";
      loginForm.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      signupForm.classList.add("hidden");
      return;
    }

    authStatus.textContent = `Logged in as ${currentUser.username} (${currentUser.role})`;
    loginForm.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    signupForm.classList.remove("hidden");

    if (currentUser.role === "student") {
      emailInput.value = currentUser.email;
      emailInput.readOnly = true;
    } else {
      emailInput.value = "";
      emailInput.readOnly = false;
    }
  }

  function setAuthState(nextToken, user) {
    token = nextToken || "";
    currentUser = user || null;

    if (token) {
      localStorage.setItem("authToken", token);
    } else {
      localStorage.removeItem("authToken");
    }

    updateAuthUI();
  }

  async function apiFetch(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      setAuthState("", null);
      showMessage("Your session has expired. Please log in again.", "error");
    }

    return response;
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    if (!token) {
      activitiesList.innerHTML = "<p>Please log in to view activities.</p>";
      return;
    }

    try {
      const response = await apiFetch("/activities");

      if (!response.ok) {
        const result = await response.json();
        if (response.status === 403) {
          activitiesList.innerHTML = `<p>${result.detail}</p>`;
          return;
        }
        throw new Error(result.detail || "Failed to load activities");
      }

      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      const canAdminUnregister = currentUser && currentUser.role === "admin";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        canAdminUnregister
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      if (canAdminUnregister) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      setAuthState(result.token, result.user);
      showMessage(`Welcome, ${result.user.username}!`, "success");
      loginForm.reset();
      fetchActivities();
    } catch (error) {
      showMessage("Unable to log in right now.", "error");
      console.error("Error during login:", error);
    }
  });

  // Handle logout
  logoutBtn.addEventListener("click", async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      setAuthState("", null);
      activitiesList.innerHTML = "<p>Please log in to view activities.</p>";
      showMessage("Logged out.", "info");
    }
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        if (currentUser && currentUser.role === "student") {
          emailInput.value = currentUser.email;
        }

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  async function initializeAuthState() {
    updateAuthUI();

    if (!token) {
      activitiesList.innerHTML = "<p>Please log in to view activities.</p>";
      return;
    }

    try {
      const response = await apiFetch("/auth/me");

      if (!response.ok) {
        const result = await response.json();
        showMessage(result.detail || "Please log in.", "error");
        activitiesList.innerHTML = "<p>Please log in to view activities.</p>";
        return;
      }

      const user = await response.json();
      currentUser = user;
      updateAuthUI();
      fetchActivities();
    } catch (error) {
      setAuthState("", null);
      activitiesList.innerHTML = "<p>Please log in to view activities.</p>";
      showMessage("Unable to restore your session.", "error");
      console.error("Error restoring auth state:", error);
    }
  }

  initializeAuthState();
});
