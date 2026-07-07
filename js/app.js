class OnboardingQuiz {
    constructor(questions) {
        this.questions = questions;
        this.currentStep = 0;
        this.responses = {};

        // DOM Element Attachments
        this.cardContainer = document.getElementById('quiz-step-card');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.progressBar = document.getElementById('progress-bar');
        this.stepCounter = document.getElementById('step-counter');

        this.initEventListeners();
        this.renderStep();
    }

    initEventListeners() {
        this.nextBtn.addEventListener('click', () => this.handleNext());
        this.prevBtn.addEventListener('click', () => this.handlePrev());
    }

    renderStep() {
        if (this.currentStep >= this.questions.length) {
            this.renderSummary();
            return;
        }

        const question = this.questions[this.currentStep];
        this.updateGlobalUI();

        let htmlContent = `
            <h2 class="step-title">${question.title}</h2>
            <p class="step-subtitle">${question.subtitle}</p>
            <div class="input-container">
        `;

        const savedValue = this.responses[question.id] || '';

        // Conditional rendering engine matching field layout profiles
        if (question.type === 'text' || question.type === 'number' || question.type === 'weight-lbs') {
            const inputType = question.type === 'text' ? 'text' : 'number';
            const suffix = question.type === 'weight-lbs' ? ' lbs' : '';
            htmlContent += `
                <div class="input-text-wrapper">
                    <input type="${inputType}" id="input-${question.id}" class="input-text" 
                           placeholder="${question.placeholder}" value="${savedValue}" autocomplete="off">
                </div>
            `;
        } else if (question.type === 'height-dual') {
            const savedFeet = this.responses[question.id]?.feet || '';
            const savedInches = this.responses[question.id]?.inches || '';
            htmlContent += `
                <div class="dual-input-row">
                    <div class="input-group">
                        <label class="input-label">Feet</label>
                        <input type="number" id="height-ft" class="input-text" placeholder="ft" value="${savedFeet}">
                    </div>
                    <div class="input-group">
                        <label class="input-label">Inches</label>
                        <input type="number" id="height-in" class="input-text" placeholder="in" value="${savedInches}">
                    </div>
                </div>
            `;
        } else if (question.type === 'single-select' || question.type === 'multi-select') {
            htmlContent += `<div class="options-grid">`;
            question.options.forEach(opt => {
                let isSelected = false;
                if (question.type === 'single-select') isSelected = savedValue === opt;
                if (question.type === 'multi-select') isSelected = Array.isArray(savedValue) && savedValue.includes(opt);

                htmlContent += `
                    <div class="option-item ${isSelected ? 'selected' : ''}" data-value="${opt}">
                        <span>${opt}</span>
                        ${question.type === 'multi-select' ? '<div class="checkbox-indicator"></div>' : ''}
                    </div>
                `;
            });
            htmlContent += `</div>`;
        }

        htmlContent += `</div>`;
        this.cardContainer.innerHTML = htmlContent;
        this.attachStepEventListeners();
    }

    attachStepEventListeners() {
        const question = this.questions[this.currentStep];

        if (question.type === 'single-select' || question.type === 'multi-select') {
            const options = this.cardContainer.querySelectorAll('.option-item');
            options.forEach(item => {
                item.addEventListener('click', () => {
                    const val = item.getAttribute('data-value');
                    if (question.type === 'single-select') {
                        this.responses[question.id] = val;
                        // Fast-forward user interaction rhythm on single selections
                        setTimeout(() => this.handleNext(), 200);
                    } else {
                        if (!Array.isArray(this.responses[question.id])) {
                            this.responses[question.id] = [];
                        }
                        const idx = this.responses[question.id].indexOf(val);
                        if (idx > -1) {
                            this.responses[question.id].splice(idx, 1);
                        } else {
                            this.responses[question.id].push(val);
                        }
                        this.renderStep();
                    }
                });
            });
        }
    }

    saveCurrentResponse() {
        if (this.currentStep >= this.questions.length) return true;
        const question = this.questions[this.currentStep];

        if (question.type === 'text' || question.type === 'number' || question.type === 'weight-lbs') {
            const input = document.getElementById(`input-${question.id}`);
            if (input) {
                this.responses[question.id] = input.value;
            }
        } else if (question.type === 'height-dual') {
            const ft = document.getElementById('height-ft').value;
            const inVal = document.getElementById('height-in').value;
            this.responses[question.id] = { feet: ft, inches: inVal };
        }

        // Implicit execution validation
        return this.validateCurrentResponse();
    }

    validateCurrentResponse() {
        const question = this.questions[this.currentStep];
        const val = this.responses[question.id];

        if (question.validate) {
            if (question.type === 'height-dual') {
                return question.validate(val?.feet, val?.inches);
            }
            return question.validate(val);
        }

        if (question.type === 'multi-select') {
            return val && val.length > 0;
        }

        return val !== undefined && val !== '';
    }

    handleNext() {
        if (this.saveCurrentResponse()) {
            this.currentStep++;
            this.renderStep();
        } else {
            // Soft validation flash indicator
            this.cardContainer.style.animation = 'none';
            this.cardContainer.offsetHeight; // Reflow
            this.cardContainer.style.animation = 'fadeInUp 0.3s ease';
        }
    }

    handlePrev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    }

    updateGlobalUI() {
        const total = this.questions.length;
        this.stepCounter.textContent = `Step ${this.currentStep + 1} of ${total}`;
        this.progressBar.style.width = `${((this.currentStep) / total) * 100}%`;
        this.prevBtn.disabled = this.currentStep === 0;
        this.nextBtn.textContent = this.currentStep === total - 1 ? "Complete" : "Next";
    }

    renderSummary() {
        this.stepCounter.textContent = "Onboarding Complete";
        this.progressBar.style.width = "100%";
        this.prevBtn.style.display = "none";
        this.nextBtn.textContent = "Build My Workouts";

        // Generate JSON output payload for easy integration with backend/Supabase later
        console.log("Onboarding Data Capture Payload:", this.responses);

        let heightString = this.responses.height ? `${this.responses.height.feet}'${this.responses.height.inches}"` : 'N/A';
        let positions = Array.isArray(this.responses.position) ? this.responses.position.join(', ') : this.responses.position;
        let trainingDays = Array.isArray(this.responses.schedule) ? this.responses.schedule.join(', ') : this.responses.schedule;

        this.cardContainer.innerHTML = `
            <h2 class="step-title">Profile Calibrated.</h2>
            <p class="step-subtitle">Data points analyzed for custom physical loading filters.</p>
            <div class="options-grid" style="margin-top: 24px;">
                <div class="summary-item"><span class="summary-label">Athlete</span><span class="summary-value">${this.responses.name}</span></div>
                <div class="summary-item"><span class="summary-label">Age Index</span><span class="summary-value">${this.responses.age} Yrs</span></div>
                <div class="summary-item"><span class="summary-label">Gender</span><span class="summary-value">${this.responses.gender}</span></div>
                <div class="summary-item"><span class="summary-label">Position</span><span class="summary-value" style="font-size:0.85rem; max-width: 60%; text-align:right;">${positions}</span></div>
                <div class="summary-item"><span class="summary-label">Height</span><span class="summary-value">${heightString}</span></div>
                <div class="summary-item"><span class="summary-label">Mass Scale</span><span class="summary-value">${this.responses.weight} lbs</span></div>
                <div class="summary-item"><span class="summary-label">Schedule Block</span><span class="summary-value" style="font-size:0.85rem; max-width: 60%; text-align:right;">${trainingDays}</span></div>
            </div>
        `;
        
        // Final action override behavior
        this.nextBtn.onclick = () => {
            alert("Profile successfully committed to application store pipeline!");
        };
    }
}

// Global Lifecycle Initialization
document.addEventListener('DOMContentLoaded', () => {
    window.AppQuiz = new OnboardingQuiz(quizQuestions);
});
