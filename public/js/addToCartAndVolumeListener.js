
//Function to handle volume dropdown logic
function attachVolumeOptionListeners(itemVolumes) {
    itemVolumes.forEach(function (itemVolume) {
        // Scope elements to the current grocery_item to avoid interference
        const groceryItem = itemVolume.closest('.grocery_item'); // Limit scope to individual grocery_item
        if (!groceryItem) {
            console.error('Error: .grocery_item not found for itemVolume', itemVolume);
            return; // Skip this iteration if groceryItem is null
        }

        const packed = groceryItem.getAttribute('data-packed');
        const dropdown = itemVolume.querySelector('.item_volume_options');
        if (!dropdown) {
            console.error('Error: .item_volume_options not found inside itemVolume', itemVolume);
            return; // Skip if dropdown is missing
        }

        const customOption = dropdown.querySelector('.item_volume_custom_option');
        if (!customOption) {
            console.error('Error: .item_volume_custom_option not found inside dropdown', dropdown);
            return; // Skip further processing for this iteration if customOption is missing
        }
        const doneButton = customOption.querySelector('.item_volume_custom_option_done_btn');
        const volumeOptions = dropdown.querySelectorAll('.item_volume_option');

        // Scoped elements within the current grocery_item
        const minVolume = groceryItem.querySelector('.item_min_volume');
        const maxVolume = groceryItem.querySelector('.item_max_volume');
        const itemPrice = groceryItem.querySelector('.item_price');
        const itemWeight = groceryItem.querySelector('.item_weight');
        const inputPrice = customOption.querySelector('.item_volume_input_price');
        const inputWeightElement = customOption.querySelector('.item_volume_input_number');
        const radioButtonKggm = customOption.querySelectorAll('input[name="kggm"]');


        // Toggle dropdown visibility on item_volume click
        itemVolume.addEventListener('click', function (event) {
            closeAllDropdowns();
            dropdown.classList.toggle('show');
            event.stopPropagation(); // Prevent the click from bubbling up
        });

        // Attach event listener for predefined volume options
        volumeOptions.forEach(function (option) {
            option.addEventListener('click', function (event) {
                const selectedPrice = option.querySelector('.item_option_price').textContent;
                const selectedWeight = option.querySelector('.item_option_weight').textContent;

                // Update price and weight elements scoped to current grocery_item
                itemPrice.textContent = selectedPrice;
                itemWeight.textContent = selectedWeight;

                // Close dropdown after selection
                dropdown.classList.remove('show');
                event.stopPropagation();
            });
        });

        // Prevent dropdown from closing when clicking on custom option area
        customOption.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        // Event listener for custom "Done" button to close dropdown
        doneButton.addEventListener('click', function (event) {
            dropdown.classList.remove('show');
            event.stopPropagation();
        });

        // Event listener for custom weight input changes
        inputWeightElement.addEventListener('input', function (event) {
            const value = parseFloat(event.target.value.trim());
            if (value < 0) {
                event.target.value = 0;
            }
            getClosestWeightAndPrice(value, true, this); // Pass context for current grocery_item
        });

        // Event listener for kg/gm radio button changes
        radioButtonKggm.forEach(function (radioButton) {
            radioButton.addEventListener('change', function () {
                getClosestWeightAndPrice(inputWeightElement.value.trim(), false, this);
            });
        });

        // Adjusted getClosestWeightAndPrice to update elements only within current grocery_item
        function getClosestWeightAndPrice(inputData, flag, context) {
            if (!inputData) {
                inputPrice.textContent = 0;
                return;
            }

            if (packed === "false") {
                const selectedKggm = customOption.querySelector('input[name="kggm"]:checked');
                const minVol = convertToGrams(getSafeTextContent(minVolume));
                const maxVol = convertToGrams(getSafeTextContent(maxVolume));

                const weight = inputData + " " + selectedKggm.value.trim();
                const targetWeight = convertToGrams(weight);
                const weightElements = dropdown.querySelectorAll('.item_option_weight');
                const priceElements = dropdown.querySelectorAll('.item_option_price');

                let closestWeight = null;
                let closestPrice = null;
                let closestDifference = Infinity;

                // Loop through available weights to find closest match
                weightElements.forEach((weightElement, index) => {
                    const currentWeight = convertToGrams(weightElement.textContent);
                    const difference = Math.abs(targetWeight - currentWeight);

                    if (difference < closestDifference) {
                        closestDifference = difference;
                        closestWeight = currentWeight;
                        closestPrice = parseFloat(priceElements[index].textContent);
                    }
                });

                const rate = closestPrice / closestWeight;
                const newPrice = (rate * targetWeight).toFixed(2);

                // Update only if within the valid min-max volume range
                if (targetWeight >= minVol && targetWeight <= maxVol) {
                    inputPrice.textContent = newPrice;
                    itemPrice.textContent = newPrice;
                    itemWeight.textContent = weight;
                } else {
                    inputPrice.textContent = 0;
                    showAlert(`Item should be in range from ${getSafeTextContent(minVolume)} to ${getSafeTextContent(maxVolume)}.`, 'negative');
                }
            } else if (packed === "true") {
                // For packed items
                const inputDataVal = Math.round(inputData); // round the inputData to the nearest whole number
                if (flag) {
                    context.value = inputDataVal;
                }
                inputData = inputDataVal;
                const minVol = parseInt(getSafeTextContent(minVolume));
                const maxVol = parseInt(getSafeTextContent(maxVolume));
                const itemQty = parseInt(getSafeTextContent(itemWeight));
                const itemPriceForQty = parseFloat(itemPrice.textContent);
                const rate = itemPriceForQty / itemQty;
                const newPrice = (rate * inputData).toFixed(2);

                // Update if within valid min-max quantity range
                if (inputData >= minVol && inputData <= maxVol) {
                    inputPrice.textContent = newPrice;
                    itemPrice.textContent = newPrice;
                    itemWeight.textContent = inputData;
                } else {
                    inputPrice.textContent = 0;
                    showAlert(`Item should be in range from ${getSafeTextContent(minVolume)} to ${getSafeTextContent(maxVolume)}.`, 'negative');
                }
            } else {
                showAlert("Something went wrong to calculate price.", "negative");
            }
        }
    });

    // Global listener to close dropdowns except the currently open one
    document.addEventListener('click', function () {
        closeAllDropdowns();
    });
}

// Function to attach 'Add' button event listeners
function attachAddButtonListeners(addButtons) {
    addButtons.forEach(function (button) {
        // Ensure we don't add the event listener multiple times by checking for an existing one
        if (!button.dataset.listenerAttached) {
            button.addEventListener('click', function () {
                console.log("add button clicked.");
                let itemDiv = button.closest('.grocery_item');
                let itemCategory = button.parentElement.getAttribute('data-itemCategory');
                let itemSubCategory = button.parentElement.getAttribute('data-itemSubCategory');
                let itemName = itemDiv.querySelector('.item_name');
                let itemWeight = itemDiv.querySelector('.item_weight');
                this.disabled = true;
                document.getElementById("loader_container").style.display = "flex";

                addToCart(this, getSafeTextContent(itemName), String(itemWeight.textContent), String(itemCategory), String(itemSubCategory));
            });

            // Mark that a listener has been attached to this button
            button.dataset.listenerAttached = true;
        }
    });
}


// Helper function to close all open dropdowns
function closeAllDropdowns() {
    document.querySelectorAll('.item_volume_options.show').forEach(function (dropdown) {
        dropdown.classList.remove('show');
    });
}



// Function to send the product ID to the backend
function addToCart(context, itemName, itemWeight, itemCat, itemSubCat) {
    fetch('/add_to_cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            itemName: itemName.toLowerCase(),
            itemWeight: itemWeight,
            itemCategory: itemCat.toLowerCase(),
            itemSubCategory: itemSubCat.toLowerCase()
        })
    })
        .then(response => {
            if (!response.ok) {
                context.disabled = false;
                document.getElementById("loader_container").style.display = "none";

                showAlert('Failed to add item to cart.', 'negative');
                throw new Error('Failed to add item to cart');
            }
            return response.json();
        })
        .then(data => {
            context.disabled = false;
            document.getElementById("loader_container").style.display = "none";

            if (data.type == "positive") {
                showAlert('Item successfully added to cart.', data.type);
            }
            else {
                showAlert(data.message, data.type);
            }
            console.log(data.message);
            $('.cart_item_no').text(data.totalCart);
        })
        .catch(error => {
            context.disabled = false;
            document.getElementById("loader_container").style.display = "none";

            showAlert('Error adding item to cart.', 'negative');
            console.error('Error adding item to cart:', error);
        });
}


// Utility to convert kg/gm to grams
function convertToGrams(value) {
    if (typeof value === 'string' && value.includes('kg')) {
        return parseFloat(value) * 1000;
    } else {
        return parseInt(value);
    }
}

function getSafeTextContent(element) {
    if (element && typeof element.textContent === 'string') {
        // Sanitize text content but allow &, -, ( )
        const sanitizedText = element.textContent
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return sanitizedText;
    } else {
        showAlert('Invalid characters detected.', 'negative');
        return '';
    }
}

const itemVolume = document.querySelectorAll('.item_volume');
const itemAddBtn = document.querySelectorAll('.item_add_btn');
if(itemVolume && itemAddBtn){
    attachVolumeOptionListeners(itemVolume);
    attachAddButtonListeners(itemAddBtn);
}
