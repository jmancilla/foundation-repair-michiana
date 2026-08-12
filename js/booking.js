document.addEventListener('DOMContentLoaded', () => {
  // Bail out if this page does not contain the booking wizard
  if (!document.getElementById('inspection-form') || !document.getElementById('btn-next')) return;

  // Pre-fill city from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const cityParam = urlParams.get('city');
  const citySelect = document.getElementById('city');
  if (citySelect && cityParam) {
    const cityKey = (str) => str.toLowerCase().replace(/,.*$/, '').replace(/[^a-z]/g, '');
    const target = cityKey(cityParam);
    for (let option of citySelect.options) {
      if (cityKey(option.value) === target) {
        citySelect.value = option.value;
        break;
      }
    }
  }

  // Set hidden timestamp for server-side time-trap anti-spam
  const hpTime = document.getElementById('hp-time');
  if (hpTime) {
    hpTime.value = Math.floor(Date.now() / 1000);
  }

  // Wizard state
  let currentStep = 1;
  const totalSteps = 3;
  
  // Elements
  const steps = document.querySelectorAll('.wizard-step');
  const panels = document.querySelectorAll('.wizard-panel');
  const progressBar = document.getElementById('progress-bar');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const bookingForm = document.getElementById('inspection-form');
  const wizardContent = document.getElementById('wizard-content');
  const wizardSuccess = document.getElementById('wizard-success');

  // Summary Elements
  const summaryPlan = document.getElementById('summary-plan');
  const summaryRange = document.getElementById('summary-range');
  const summaryDetails = document.getElementById('summary-details');

  // Inline validation helpers
  function setFieldError(errorEl, inputEl, message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
    if (inputEl) {
      inputEl.classList.add('field-invalid');
    }
  }

  function clearFieldError(errorEl, inputEl) {
    if (errorEl) errorEl.hidden = true;
    if (inputEl) inputEl.classList.remove('field-invalid');
  }

  function clearErrors() {
    document.querySelectorAll('.wizard-error').forEach(el => {
      el.hidden = true;
    });
    document.querySelectorAll('.field-invalid').forEach(el => {
      el.classList.remove('field-invalid');
    });
  }

  // Clear individual field errors as the user corrects their input
  ['name', 'email', 'phone', 'city', 'property-age', 'pref-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => clearFieldError(document.getElementById('error-' + id), el));
      el.addEventListener('change', () => clearFieldError(document.getElementById('error-' + id), el));
    }
  });

  // Toggle the date field when "no preferred date" is selected
  const flexDateToggle = document.getElementById('flex-date');
  const prefDateInput = document.getElementById('pref-date');
  if (flexDateToggle && prefDateInput) {
    flexDateToggle.addEventListener('change', () => {
      if (flexDateToggle.checked) {
        prefDateInput.value = '';
        prefDateInput.disabled = true;
      } else {
        prefDateInput.disabled = false;
      }
    });
  }

  // Format phone number as (xxx) xxx-xxxx while the user types
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      const digits = phoneInput.value.replace(/\D/g, '').slice(0, 10);
      if (digits.length > 6) {
        phoneInput.value = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      } else if (digits.length > 3) {
        phoneInput.value = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      } else {
        phoneInput.value = digits;
      }
    });
  }

  // Base costs for estimation
  const costMap = {
    'wet-basement': { low: 3500, high: 9000, name: 'Waterproofing & Drainage' },
    'wall-cracks': { low: 800, high: 2200, name: 'Epoxy Crack Injection' },
    'bowing-walls': { low: 4000, high: 8500, name: 'Wall Anchors/Stabilization' },
    'uneven-concrete': { low: 1200, high: 3800, name: 'Slab Leveling/Slabjacking' },
    'sinking-foundation': { low: 8000, high: 18000, name: 'Foundation Piering/Underpinning' },
    'crawl-space': { low: 3000, high: 10000, name: 'Crawl Space Encapsulation' }
  };

  // 1. Selection Card Interactions
  const selectionCards = document.querySelectorAll('.selection-card');
  selectionCards.forEach(card => {
    const input = card.querySelector('input');
    
    // Synch card class on initial render
    if (input && input.checked) {
      card.classList.add('selected');
    }

    // Show/hide the foundation error immediately when the group changes
    function updateFoundationError() {
      if (input.type !== 'radio' || input.name !== 'foundation-type') return;
      const foundation = document.querySelector('input[name="foundation-type"]:checked');
      if (foundation) {
        clearFieldError(document.getElementById('error-foundation'), null);
      } else {
        setFieldError(document.getElementById('error-foundation'), null, 'Please select your foundation structure type.');
      }
    }

    card.addEventListener('click', (e) => {
      // Avoid double triggering if clicking input label/checkbox directly
      if (e.target.tagName !== 'INPUT') {
        if (input.type === 'checkbox') {
          input.checked = !input.checked;
        } else if (input.type === 'radio') {
          const groupName = input.name;
          const wasChecked = input.checked;
          document.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
            radio.closest('.selection-card').classList.remove('selected');
            radio.checked = false;
          });
          input.checked = !wasChecked;
        }
        input.dispatchEvent(new Event('change'));
      }
      
      if (input.checked) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
      
      calculateEstimate();
    });

    if (input) {
      input.addEventListener('change', () => {
        if (input.checked) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
        updateFoundationError();
        calculateEstimate();
      });
    }
  });

  // 2. Estimate Calculator
  function calculateEstimate() {
    let lowTotal = 0;
    let highTotal = 0;
    const selectedServices = [];
    
    // Read checked issues
    const checkedIssues = document.querySelectorAll('input[name="issues"]:checked');
    checkedIssues.forEach(input => {
      const val = input.value;
      if (costMap[val]) {
        lowTotal += costMap[val].low;
        highTotal += costMap[val].high;
        selectedServices.push(costMap[val].name);
      }
    });

    // Update Estimate Widget
    if (summaryPlan && summaryRange && summaryDetails) {
      if (selectedServices.length === 0) {
        summaryPlan.textContent = 'None Selected';
        summaryRange.textContent = 'Select an issue to begin';
        summaryDetails.innerHTML = '<p style="color: var(--text-muted);">Please select one or more structural issues in Step 1 to generate a customized assessment plan.</p>';
        return;
      }

      // Generate Recommended Plan Title
      let planTitle = 'Custom Maintenance Plan';
      if (selectedServices.length === 1) {
        planTitle = `Recommended: ${selectedServices[0]} Plan`;
      } else if (selectedServices.includes('Foundation Piering/Underpinning') || selectedServices.includes('Wall Anchors/Stabilization')) {
        planTitle = 'Urgent Structural Stabilization Plan';
      } else if (selectedServices.includes('Waterproofing & Drainage')) {
        planTitle = 'Basement Moisture Mitigation Plan';
      }

      summaryPlan.textContent = planTitle;
      summaryRange.innerHTML = `$${lowTotal.toLocaleString()} - $${highTotal.toLocaleString()}`;

      // Build specific recommended steps
      let stepsHTML = '<ul>';
      checkedIssues.forEach(input => {
        const val = input.value;
        if (val === 'wet-basement') {
          stepsHTML += '<li><strong>Waterproofing:</strong> Sub-floor French drains & sump-pump system installation.</li>';
        } else if (val === 'wall-cracks') {
          stepsHTML += '<li><strong>Structural Cracks:</strong> Polyurethane expanding foam and epoxy structural injections.</li>';
        } else if (val === 'bowing-walls') {
          stepsHTML += '<li><strong>Wall Stabilization:</strong> Installation of heavy-duty carbon fiber straps or wall plate anchors.</li>';
        } else if (val === 'uneven-concrete') {
          stepsHTML += '<li><strong>Concrete Lifting:</strong> Polyurethane foam injection (Slabjacking) to level uneven areas.</li>';
        } else if (val === 'sinking-foundation') {
          stepsHTML += '<li><strong>Pier Installation:</strong> Steel push piers or helical piers driven into load-bearing strata.</li>';
        } else if (val === 'crawl-space') {
          stepsHTML += '<li><strong>Encapsulation:</strong> 20-mil vapor barrier encapsulation, crawl space sealing & dehumidifier.</li>';
        }
      });
      stepsHTML += '</ul>';
      summaryDetails.innerHTML = stepsHTML;
    }
  }

  // 3. Navigation Controls
  function updateWizardUI() {
    clearErrors();

    // Ensure success card is strictly hidden during wizard steps
    if (wizardSuccess) {
      wizardSuccess.style.display = 'none';
      wizardSuccess.classList.add('hidden');
    }
    if (wizardContent) {
      wizardContent.style.display = '';
    }

    // Update active step headers
    steps.forEach((step, idx) => {
      if (idx + 1 < currentStep) {
        step.classList.add('completed');
        step.classList.remove('active');
      } else if (idx + 1 === currentStep) {
        step.classList.add('active');
        step.classList.remove('completed');
      } else {
        step.classList.remove('active', 'completed');
      }
    });

    // Update progress bar width
    const progressWidth = ((currentStep - 1) / (totalSteps - 1)) * 100;
    progressBar.style.width = `${progressWidth}%`;

    // Show/Hide Panels
    panels.forEach((panel, idx) => {
      if (idx + 1 === currentStep) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Toggle Navigation Buttons
    if (currentStep === 1) {
      btnPrev.style.visibility = 'hidden';
    } else {
      btnPrev.style.visibility = 'visible';
    }

    if (currentStep === totalSteps) {
      btnNext.textContent = 'Submit Request';
      btnNext.classList.add('btn-submit');
    } else {
      btnNext.textContent = 'Continue';
      btnNext.classList.remove('btn-submit');
    }
  }

  function validateStep(step) {
    if (step === 1) {
      const selected = document.querySelectorAll('input[name="issues"]:checked');
      if (selected.length === 0) {
        setFieldError(document.getElementById('error-issues'), null, 'Please select at least one issue indicator to proceed.');
        return false;
      }
    } else if (step === 2) {
      const foundationType = document.querySelector('input[name="foundation-type"]:checked');
      const propertyAge = document.getElementById('property-age').value;

      if (!foundationType) {
        setFieldError(document.getElementById('error-foundation'), null, 'Please select your foundation structure type.');
        return false;
      }
      if (!propertyAge) {
        setFieldError(document.getElementById('error-age'), document.getElementById('property-age'), 'Please provide the approximate age of your home.');
        return false;
      }
    } else if (step === 3) {
      const nameEl = document.getElementById('name');
      const emailEl = document.getElementById('email');
      const phoneEl = document.getElementById('phone');
      const cityEl = document.getElementById('city');
      const dateEl = document.getElementById('pref-date');
      const flexDate = document.getElementById('flex-date');

      const name = nameEl.value.trim();
      const email = emailEl.value.trim();
      const phone = phoneEl.value.trim();
      const city = cityEl.value;

      let valid = true;

      if (name.length < 2) {
        setFieldError(document.getElementById('error-name'), nameEl, 'Please enter your full name.');
        valid = false;
      }

      if (!city) {
        setFieldError(document.getElementById('error-city'), cityEl, 'Please select your nearest city.');
        valid = false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || email.length > 254 || !emailRegex.test(email)) {
        setFieldError(document.getElementById('error-email'), emailEl, 'Please enter a valid email address.');
        valid = false;
      }

      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        setFieldError(document.getElementById('error-phone'), phoneEl, 'Please enter a valid 10-digit phone number.');
        valid = false;
      }

      if (!flexDate || !flexDate.checked) {
        if (dateEl.value) {
          const today = new Date();
          const todayStr = today.getFullYear() + '-' +
            String(today.getMonth() + 1).padStart(2, '0') + '-' +
            String(today.getDate()).padStart(2, '0');
          if (dateEl.value < todayStr) {
            setFieldError(document.getElementById('error-date'), dateEl, 'Please choose a future date or select "I don\'t have a preferred date".');
            valid = false;
          }
        }
      }

      return valid;
    }
    return true;
  }

  // Next Button Click
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (!validateStep(currentStep)) return;

      if (currentStep < totalSteps) {
        currentStep++;
        updateWizardUI();
      } else {
        // Handle form submission
        submitForm();
      }
    });
  }

  // Prev Button Click
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
      }
    });
  }

  // Form Submission
  function submitForm() {
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const city = document.getElementById('city').value;
    const date = document.getElementById('pref-date').value;
    const foundationType = document.querySelector('input[name="foundation-type"]:checked').value;

    const checkedIssues = document.querySelectorAll('input[name="issues"]:checked');
    const issuesList = [];
    checkedIssues.forEach(i => {
      const labelText = i.closest('.selection-card').querySelector('h4').textContent;
      issuesList.push(labelText);
    });

    const rangeEstimate = summaryRange.textContent;
    const recommendedPlan = summaryPlan.textContent;

    // Attach wizard context to the form payload
    document.getElementById('hidden-issues').value = issuesList.join(', ');
    document.getElementById('hidden-foundation').value = foundationType;
    document.getElementById('hidden-plan').value = recommendedPlan;
    document.getElementById('hidden-estimate').value = rangeEstimate;

    // Disable the submit button while the request is in flight
    if (btnNext) {
      btnNext.disabled = true;
      btnNext.textContent = 'Sending...';
    }

    fetch('lead.php', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(bookingForm)
    })
      .then(response => {
        if (!response.ok) throw new Error('Request failed');
        return response.json();
      })
      .then(data => {
        if (!data.ok) throw new Error('Request failed');
        showSuccess(name, phone, email, city, recommendedPlan, rangeEstimate, date);
      })
      .catch(() => {
        alert('Sorry, we could not submit your request. Please try again or call (574) 800-4540.');
      })
      .finally(() => {
        if (btnNext) {
          btnNext.disabled = false;
          btnNext.textContent = 'Submit Request';
        }
      });
  }

  function showSuccess(name, phone, email, city, recommendedPlan, rangeEstimate, date) {
    if (wizardSuccess) {
      document.getElementById('success-name').textContent = name;
      document.getElementById('success-phone').textContent = phone;
      document.getElementById('success-email').textContent = email;
      document.getElementById('success-city').textContent = city;
      document.getElementById('success-plan').textContent = recommendedPlan;
      document.getElementById('success-estimate').textContent = rangeEstimate;
      document.getElementById('success-date').textContent = date ? date : 'Flexible';

      // Toggle visibility
      wizardContent.style.display = 'none';
      wizardSuccess.style.display = 'block';
      wizardSuccess.classList.remove('hidden');

      // Scroll to top of wizard
      document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Initialize Estimator
  calculateEstimate();
  updateWizardUI();
});
