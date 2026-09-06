const APPOINTMENT_API_URL = "https://5wkbhqk1n9.execute-api.ap-south-1.amazonaws.com/appointments";
const USE_REAL_APPOINTMENT_API = true;
const ORDER_API_URL = "https://5wkbhqk1n9.execute-api.ap-south-1.amazonaws.com/orders";
const USE_REAL_ORDER_API = true;

const doctors = [
  {
    id: "D001",
    name: "Dr. Ahmed Raza",
    speciality: "Cardiologist",
    timing: "Mon - Sun | 10:00 AM - 1:00 PM",
    slots: ["10:00 AM", "11:00 AM", "12:00 PM"],
    room: "Room 101",
    fee: 1500
  },
  {
    id: "D002",
    name: "Dr. Sana Malik",
    speciality: "Gynecologist",
    timing: "Mon - Sun | 2:00 PM - 5:00 PM",
    slots: ["2:00 PM", "3:00 PM", "4:00 PM"],
    room: "Room 102",
    fee: 1800
  },
  {
    id: "D003",
    name: "Dr. Bilal Khan",
    speciality: "Neurologist",
    timing: "Mon - Sun | 6:00 PM - 9:00 PM",
    slots: ["6:00 PM", "7:00 PM", "8:00 PM"],
    room: "Room 103",
    fee: 2000
  },
  {
    id: "D004",
    name: "Dr. Ayesha Noor",
    speciality: "Dermatologist",
    timing: "Mon - Sun | 4:00 PM - 7:00 PM",
    slots: ["4:00 PM", "5:00 PM", "6:00 PM"],
    room: "Room 104",
    fee: 1600
  }
];

const defaultMedicines = [
  { id: 1, name: "Panadol", category: "Pain Relief", stock: 45, price: 80 },
  { id: 2, name: "Brufen", category: "Pain Relief", stock: 20, price: 120 },
  { id: 3, name: "Augmentin", category: "Antibiotic", stock: 0, price: 450 },
  { id: 4, name: "Flagyl", category: "Antibiotic", stock: 13, price: 160 },
  { id: 5, name: "Cetirizine", category: "Allergy", stock: 30, price: 70 },
  { id: 6, name: "ORS Sachet", category: "Hydration", stock: 60, price: 35 },
  { id: 7, name: "Insulin", category: "Diabetes", stock: 0, price: 950 },
  { id: 8, name: "Aspirin", category: "Heart Care", stock: 25, price: 90 },
  { id: 9, name: "Omeprazole", category: "Stomach Care", stock: 18, price: 140 },
  { id: 10, name: "Calcium Tablets", category: "Supplement", stock: 9, price: 280 },
  { id: 11, name: "Cough Syrup", category: "Cold & Flu", stock: 16, price: 210 },
  { id: 12, name: "Thermometer", category: "Medical Device", stock: 6, price: 650 }
];

let medicines = JSON.parse(localStorage.getItem("akmc_medicines")) || defaultMedicines;
let appointments = JSON.parse(localStorage.getItem("akmc_appointments")) || [];
let orders = JSON.parse(localStorage.getItem("akmc_orders")) || [];
let cart = [];

const tabButtons = document.querySelectorAll(".tab-btn");
const tabSections = document.querySelectorAll(".tab-section");
const doctorCards = document.getElementById("doctorCards");
const doctorSelect = document.getElementById("doctorSelect");
const slotSelect = document.getElementById("slotSelect");
const medicineCards = document.getElementById("medicineCards");
const medicineSearch = document.getElementById("medicineSearch");
const stockFilter = document.getElementById("stockFilter");
const appointmentForm = document.getElementById("appointmentForm");
const appointmentResult = document.getElementById("appointmentResult");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const orderForm = document.getElementById("orderForm");
const orderResult = document.getElementById("orderResult");

function saveData() {
  localStorage.setItem("akmc_medicines", JSON.stringify(medicines));
  localStorage.setItem("akmc_appointments", JSON.stringify(appointments));
  localStorage.setItem("akmc_orders", JSON.stringify(orders));
  updateHomeStats();
}

function updateHomeStats() {
  document.getElementById("homeMedicineCount").textContent = medicines.length;
  document.getElementById("homeOrderCount").textContent = appointments.length + orders.length;
}

function openTab(tabName) {
  tabSections.forEach(section => section.classList.remove("active-section"));
  tabButtons.forEach(button => button.classList.remove("active"));

  document.getElementById(tabName).classList.add("active-section");

  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeButton) activeButton.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

tabButtons.forEach(button => {
  button.addEventListener("click", () => openTab(button.dataset.tab));
});

function showDoctors() {
  doctorCards.innerHTML = "";
  doctorSelect.innerHTML = `<option value="">Select Doctor</option>`;

  doctors.forEach((doctor) => {
    doctorCards.innerHTML += `
      <div class="card">
        <span class="badge">${doctor.speciality}</span>
        <h3>${doctor.name}</h3>
        <p><strong>Timing:</strong> ${doctor.timing}</p>
        <p><strong>Room:</strong> ${doctor.room}</p>
        <p><strong>Consultation Fee:</strong> Rs. ${doctor.fee}</p>
        <button class="primary-btn" onclick="selectDoctor('${doctor.id}')">Book This Doctor</button>
      </div>
    `;

    doctorSelect.innerHTML += `
      <option value="${doctor.id}">${doctor.name} - ${doctor.speciality}</option>
    `;
  });
}

function fillSlots(doctorId) {
  const doctor = doctors.find(doc => doc.id === doctorId);
  slotSelect.innerHTML = `<option value="">Select Slot</option>`;

  if (!doctor) return;

  doctor.slots.forEach(slot => {
    slotSelect.innerHTML += `<option value="${slot}">${slot}</option>`;
  });
}

doctorSelect.addEventListener("change", () => {
  fillSlots(doctorSelect.value);
});

function selectDoctor(doctorId) {
  doctorSelect.value = doctorId;
  fillSlots(doctorId);
  openTab("appointment");
}

function showMedicines() {
  const searchText = medicineSearch.value.toLowerCase();
  const filterValue = stockFilter.value;

  medicineCards.innerHTML = "";

  const filteredMedicines = medicines.filter((med) => {
    const matchesSearch =
      med.name.toLowerCase().includes(searchText) ||
      med.category.toLowerCase().includes(searchText);

    const matchesStock =
      filterValue === "all" ||
      (filterValue === "available" && med.stock > 0) ||
      (filterValue === "out" && med.stock === 0);

    return matchesSearch && matchesStock;
  });

  if (filteredMedicines.length === 0) {
    medicineCards.innerHTML = "<p>No medicine found.</p>";
    return;
  }

  filteredMedicines.forEach((med) => {
    let status = "Available";
    let statusClass = "available";

    if (med.stock === 0) {
      status = "Out of Stock";
      statusClass = "out";
    } else if (med.stock <= 10) {
      status = "Low Stock";
      statusClass = "low";
    }

    medicineCards.innerHTML += `
      <div class="card">
        <span class="badge ${statusClass}">${status}</span>
        <h3>${med.name}</h3>
        <p><strong>Category:</strong> ${med.category}</p>
        <p><strong>Stock:</strong> ${med.stock}</p>
        <p><strong>Price:</strong> Rs. ${med.price}</p>
        <button class="primary-btn" ${med.stock === 0 ? "disabled" : ""} onclick="addToCart(${med.id})">
          ${med.stock > 0 ? "Add to Cart" : "Unavailable"}
        </button>
      </div>
    `;
  });
}

function addToCart(id) {
  const medicine = medicines.find(med => med.id === id);
  const existingItem = cart.find(item => item.id === id);

  if (!medicine || medicine.stock === 0) return;

  if (existingItem) {
    if (existingItem.quantity < medicine.stock) {
      existingItem.quantity++;
    } else {
      alert("No more stock available for this medicine.");
    }
  } else {
    cart.push({ ...medicine, quantity: 1 });
  }

  showCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  showCart();
}

function increaseQty(id) {
  const item = cart.find(product => product.id === id);
  const medicine = medicines.find(med => med.id === id);

  if (item.quantity < medicine.stock) {
    item.quantity++;
  } else {
    alert("Stock limit reached.");
  }

  showCart();
}

function decreaseQty(id) {
  const item = cart.find(product => product.id === id);

  if (item.quantity > 1) {
    item.quantity--;
  } else {
    removeFromCart(id);
    return;
  }

  showCart();
}

function showCart() {
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = "<p>Your cart is empty.</p>";
    cartTotal.textContent = "Rs. 0";
    return;
  }

  let total = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    cartItems.innerHTML += `
      <div class="cart-item">
        <div class="cart-item-top">
          <strong>${item.name}</strong>
          <button class="small-btn" onclick="removeFromCart(${item.id})">Remove</button>
        </div>
        <p>Rs. ${item.price} x ${item.quantity} = Rs. ${itemTotal}</p>
        <div class="qty-row">
          <button class="secondary-btn" onclick="decreaseQty(${item.id})">-</button>
          <button class="secondary-btn" onclick="increaseQty(${item.id})">+</button>
        </div>
      </div>
    `;
  });

  cartTotal.textContent = `Rs. ${total}`;
}

appointmentForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  const selectedDoctor = doctors.find(doc => doc.id === doctorSelect.value);

  if (!selectedDoctor) {
    alert("Please select a doctor.");
    return;
  }

  const submitButton = appointmentForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Booking...";

  const appointment = {
    patientName: document.getElementById("patientName").value,
    phone: document.getElementById("phone").value,
    doctor: selectedDoctor.name,
    speciality: selectedDoctor.speciality,
    room: selectedDoctor.room,
    slot: slotSelect.value,
    date: document.getElementById("date").value,
    message: document.getElementById("message").value || "No message added"
  };

  try {
    let savedAppointment = null;

    if (USE_REAL_APPOINTMENT_API) {
      const response = await fetch(APPOINTMENT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(appointment)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to book appointment.");
      }

      savedAppointment = data.appointment;
    } else {
      savedAppointment = {
        ...appointment,
        appointmentId: "AKMC-APT-" + Math.floor(Math.random() * 90000 + 10000),
        status: "Booked"
      };
    }

    appointments.push({
      id: savedAppointment.appointmentId,
      patientName: savedAppointment.patientName,
      phone: savedAppointment.phone,
      doctor: savedAppointment.doctor,
      speciality: savedAppointment.speciality,
      room: savedAppointment.room,
      slot: savedAppointment.slot,
      date: savedAppointment.date,
      message: savedAppointment.message,
      status: savedAppointment.status
    });

    saveData();

    appointmentResult.classList.remove("hidden");
    appointmentResult.innerHTML = `
      <h3>Appointment Booked Successfully!</h3>
      <p><strong>Appointment ID:</strong> ${savedAppointment.appointmentId}</p>
      <p><strong>Patient:</strong> ${savedAppointment.patientName}</p>
      <p><strong>Phone:</strong> ${savedAppointment.phone}</p>
      <p><strong>Doctor:</strong> ${savedAppointment.doctor}</p>
      <p><strong>Speciality:</strong> ${savedAppointment.speciality}</p>
      <p><strong>Room:</strong> ${savedAppointment.room}</p>
      <p><strong>Date & Slot:</strong> ${savedAppointment.date} at ${savedAppointment.slot}</p>
    `;

    appointmentForm.reset();
    slotSelect.innerHTML = `<option value="">Select Slot</option>`;
  } catch (error) {
    appointmentResult.classList.remove("hidden");
    appointmentResult.innerHTML = `
      <h3>Appointment Booking Failed</h3>
      <p>${error.message}</p>
      <p>Please try again or contact the clinic directly.</p>
    `;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Confirm Appointment";
  }
});

orderForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  if (cart.length === 0) {
    alert("Please add at least one medicine to cart.");
    return;
  }

  const submitButton = orderForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Placing Order...";

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const orderPayload = {
    name: document.getElementById("customerName").value,
    contact: document.getElementById("customerContact").value,
    address: document.getElementById("customerAddress").value,
    items: cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    total
  };

  try {
    let savedOrder = null;

    if (USE_REAL_ORDER_API) {
      const response = await fetch(ORDER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to place order.");
      }

      savedOrder = data.order;
    } else {
      savedOrder = {
        ...orderPayload,
        orderId: "AKMC-ORD-" + Math.floor(Math.random() * 90000 + 10000),
        status: "Order Placed"
      };
    }

    orderPayload.items.forEach(orderItem => {
      const medicine = medicines.find(med => med.id === orderItem.id);
      if (medicine) medicine.stock -= orderItem.quantity;
    });

    orders.push({
      id: savedOrder.orderId,
      name: savedOrder.name,
      contact: savedOrder.contact,
      address: savedOrder.address,
      items: savedOrder.items,
      total: savedOrder.total,
      status: savedOrder.status
    });

    cart = [];
    saveData();
    showMedicines();
    showCart();

    const orderedItems = savedOrder.items
      .map(item => `${item.name} x ${item.quantity}`)
      .join(", ");

    orderResult.classList.remove("hidden");
    orderResult.innerHTML = `
      <h3>Medicine Order Placed Successfully!</h3>
      <p><strong>Order ID:</strong> ${savedOrder.orderId}</p>
      <p><strong>Name:</strong> ${savedOrder.name}</p>
      <p><strong>Contact:</strong> ${savedOrder.contact}</p>
      <p><strong>Address:</strong> ${savedOrder.address}</p>
      <p><strong>Items:</strong> ${orderedItems}</p>
      <p><strong>Total Bill:</strong> Rs. ${savedOrder.total}</p>
    `;

    orderForm.reset();
  } catch (error) {
    orderResult.classList.remove("hidden");
    orderResult.innerHTML = `
      <h3>Order Failed</h3>
      <p>${error.message}</p>
      <p>Please try again or contact the pharmacy directly.</p>
    `;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Place Order";
  }
});

function renderRecords() {
  const appointmentRecords = document.getElementById("appointmentRecords");
  const orderRecords = document.getElementById("orderRecords");

  appointmentRecords.innerHTML = appointments.length === 0 ? "<p>No appointment records yet.</p>" : "";
  orderRecords.innerHTML = orders.length === 0 ? "<p>No order records yet.</p>" : "";

  appointments.slice().reverse().forEach(item => {
    appointmentRecords.innerHTML += `
      <div class="record-item">
        <h3>${item.id}</h3>
        <p><strong>Patient:</strong> ${item.patientName}</p>
        <p><strong>Doctor:</strong> ${item.doctor}</p>
        <p><strong>Date:</strong> ${item.date} at ${item.slot}</p>
        <p><strong>Status:</strong> ${item.status}</p>
      </div>
    `;
  });

  orders.slice().reverse().forEach(item => {
    const itemList = item.items.map(product => `${product.name} x ${product.quantity}`).join(", ");
    orderRecords.innerHTML += `
      <div class="record-item">
        <h3>${item.id}</h3>
        <p><strong>Customer:</strong> ${item.name}</p>
        <p><strong>Items:</strong> ${itemList}</p>
        <p><strong>Total:</strong> Rs. ${item.total}</p>
        <p><strong>Status:</strong> ${item.status}</p>
      </div>
    `;
  });
}

function clearRecords() {
  const confirmClear = confirm("Are you sure you want to clear demo records and reset inventory?");
  if (!confirmClear) return;

  appointments = [];
  orders = [];
  medicines = defaultMedicines;
  cart = [];
  saveData();
  showMedicines();
  showCart();
  renderRecords();
}

medicineSearch.addEventListener("input", showMedicines);
stockFilter.addEventListener("change", showMedicines);

showDoctors();
showMedicines();
showCart();
updateHomeStats();


// Website loading animation
window.addEventListener("load", () => {
  const preloader = document.getElementById("preloader");
  setTimeout(() => {
    if (preloader) preloader.classList.add("hide");
  }, 650);
});

// Dark mode switch
const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("akmc_theme");

if (savedTheme === "dark") {
  document.body.classList.add("dark-mode");
  if (themeToggle) themeToggle.textContent = "☀️ Light";
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeToggle.textContent = isDark ? "☀️ Light" : "🌙 Dark";
    localStorage.setItem("akmc_theme", isDark ? "dark" : "light");
  });
}


// Mobile navigation toggle
const menuToggle = document.getElementById("menuToggle");
const navTabs = document.getElementById("navTabs");

if (menuToggle && navTabs) {
  menuToggle.addEventListener("click", () => {
    navTabs.classList.toggle("open");
    menuToggle.textContent = navTabs.classList.contains("open") ? "×" : "☰";
  });

  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      navTabs.classList.remove("open");
      menuToggle.textContent = "☰";
    });
  });
}
