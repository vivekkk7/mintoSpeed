document.addEventListener('DOMContentLoaded', () => {

    // Attach event listeners to all buttons
    document.querySelectorAll('.btn').forEach(button => {
        if (!button.hasAttribute('data-listener')) {
            button.setAttribute('data-listener', 'true');
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-action');
                const orderId = button.getAttribute('data-order-id');
                const name = button.getAttribute('data-name');
                const userId = button.getAttribute('data-user-id');
                openPopup(action, orderId, name, userId);
            });
        }
    });
});

// Function to open the popup
function openPopup(action, orderId, name, userId) {
    const modal = document.getElementById('messageBoxid01');
    const messageBoxHead = document.querySelector('.messageBoxHead');
    const messageBoxP = document.querySelector('.messageBoxP');
    const actionButtons = document.querySelector('.btnBoxContainer');
    actionButtons.innerHTML = `<button type="button" class="messageBoxBtn" id="actionButton">Ok</button>`;

    // Set the header and content dynamically
    messageBoxHead.textContent = `${action} Order`;
    if (action === 'Cancelled') {
        messageBoxP.innerHTML = `
              <p style="text-align: left;">Order ID: ${orderId}</p>
              <p style="text-align: left;">Name: ${name}</p>
              <textarea id="cancelReason" placeholder="Write Reason for Cancellation..." rows="3" style="width: 100%; margin-top: 5px;"></textarea>
            `;
        document.getElementById('actionButton').style.backgroundColor = "red";
    }
    else if (action === "Pending") {
        messageBoxP.innerHTML = `
            <p style="text-align: left;">Order ID: ${orderId}</p>
            <p style="text-align: left;">Name: ${name}</p>
            <label for="datetime" style=" margin-top: 7px; font-size: 13px; color: #333;">Set delivery Time:</label>
            <input type="datetime-local" id="deliverydatetime">
            `;
        document.getElementById('actionButton').style.backgroundColor = "black";
    }
    else if (action === "Completed") {
        messageBoxP.innerHTML = `<p style="text-align: left;">Order ID: ${orderId}</p><p style="text-align: left;">Name: ${name}</p>`;
        document.getElementById('actionButton').style.backgroundColor = "green";
    }

    // Update the action button text
    document.getElementById('actionButton').textContent = 'Set ' + action;

    // Attach the action handler to the button
    document.getElementById('actionButton').onclick = function () {
        const deliveryDateTime = action === 'Pending' ? document.getElementById('deliverydatetime').value : null;
        const cancelReason = action === 'Cancelled' ? document.getElementById('cancelReason').value : null;
        performAction(action, orderId, cancelReason, deliveryDateTime, userId);
    };

    // Show the modal
    modal.style.display = 'flex';
}

// Function to handle the database operation
function performAction(action, orderId, cancelReason = null, deliveryDateTime = null, userId) {

    if (action === 'Cancelled') {
        let validateInput = (input) => typeof input === 'string';
        if (!validateInput(cancelReason)) {
            showAlert("Cancel reason not validated. Try again.", "negative");
        }

        if (cancelReason == null || cancelReason.length < 1) {
            showAlert("Please write Cancel reason. Try again.", "negative");
        }
        else {
            cancelReason = cancelReason.toLowerCase();
        }
    }

    const data = {
        action,
        orderId,
        cancelReason,
        deliveryDateTime,
        userId
    };

    document.getElementById("loader_container").style.display = "flex";

    fetch('/dashboard/orders/performAction', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(response => {
            showAlert(response.message, response.type);

            if (response.type == "positive") {
                if (action === 'Cancelled' || action === 'Completed') {
                    document.getElementById(`mega_container_${orderId}`).remove();
                }
                else if (action == "Pending") {
                    document.getElementById(`mega_container_${orderId}`).style.border = '2px solid green';
                    document.getElementById(`deliveryTime_${orderId}`).textContent = new Date(deliveryDateTime);
                }
                document.getElementById('messageBoxid01').style.display = 'none';
                document.getElementById("loader_container").style.display = "none";
            } else {
                document.getElementById("loader_container").style.display = "none";
            }
        })
        .catch(error => {
            console.error('Error performing action:', error);
            showAlert('Failed to perform action. Please try again.', 'negative');
            document.getElementById("loader_container").style.display = "none";
        });
}