import requests
import json, tempfile, base64
import os
from dotenv import load_dotenv
import re
from typing import Dict, Any, List

load_dotenv()

class AIdesignAssistant:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"

        if not self.api_key:
            print("⚠️ The API key was not found in environment variables")

    def create_code_generation_prompt(self, design_data, user_request):
        # Extract the enhanced design analysis
        design_analysis = design_data.get('design_analysis', {})
        
        # Detect interactive elements
        interactive_elements = self._detect_interactive_elements(design_analysis)
        
        prompt = f"""
You are an expert web developer. Convert this visual design into a COMPLETE, FUNCTIONAL, PRODUCTION-READY website.

# DESIGN ANALYSIS:
{json.dumps(design_analysis, indent=2)}

# DETECTED INTERACTIVE ELEMENTS:
{self._format_interactive_detection(interactive_elements)}

# USER REQUEST: 
{user_request}


# 🚀 CRITICAL REQUIREMENTS:

## 1. FULLY FUNCTIONAL CODE (NON-NEGOTIABLE):
- EVERY button must have working JavaScript functionality
- ALL forms must have validation and submission handling
- Navigation links must work (smooth scrolling or page navigation)
- Input fields must accept and validate user input
- If design has modals/popups, they must open/close
- All interactive elements MUST work in the browser

## 2. MULTIPLE HTML FILES IF NEEDED:
- If design has distinct sections (Home, About, Contact, etc.), generate separate HTML files
- Each page should be complete with navigation between them
- Generate: index.html, about.html, contact.html, etc. as needed
- Shared components (navbar, footer) should be consistent across pages

## 3. COMPLETE JAVASCRIPT FUNCTIONALITY:
- Form validation with real-time feedback
- Button click handlers with visual feedback (loading states, success messages)
- Modal open/close functionality
- Tab switching if tabs exist
- Accordion expand/collapse
- Image sliders/carousels if images exist
- Search functionality if search bar exists
- Filtering if product/card grid exists

## 4. PRODUCTION-READY FEATURES:
- Responsive design that works on mobile, tablet, desktop
- Accessible (ARIA labels, keyboard navigation)
- CSS transitions and animations
- Error handling
- Loading states for async operations
- Toast notifications for user feedback

## 5. SPECIFIC INSTRUCTIONS:
- If design has login form → implement mock login with local storage
- If design has contact form → implement form submission with validation
- If design has product cards → implement add to cart functionality
- If design has search bar → implement live search filtering
- If design has image gallery → implement lightbox/modal viewer

## 6. GIVE ME THE EXACT DESIGHN WHAT DRAWN ON THE WHITEBOARD

# OUTPUT FORMAT:
Return ONLY valid JSON format:

{{
    "project_structure": [
        {{"file": "index.html", "content": "Complete HTML for home page"}},
        {{"file": "styles.css", "content": "Complete CSS for all pages"}},
        {{"file": "script.js", "content": "Complete JavaScript for all functionality"}},
        {{"file": "about.html", "content": "About page HTML (if needed)"}},
        {{"file": "contact.html", "content": "Contact page HTML (if needed)"}}
    ],
    "main_html": "index.html content (for preview)",
    "main_css": "styles.css content (for preview)",
    "main_js": "script.js content (for preview)",
    "explanation": "Brief description of what you created and ALL functional features implemented",
    "layout_type": "identified layout type",
    "functional_features": ["list", "of", "working", "features"],
    "instructions": "How to run and test all functionality"
}}

# REMEMBER:
- NO placeholder functions - EVERYTHING must work
- Include console.log messages for debugging
- Use modern ES6+ JavaScript
- Make forms submit to console.log with validation
- Add event listeners for ALL interactive elements
- Generate COMPLETE working website, not just static HTML
"""

        return prompt

    def _detect_interactive_elements(self, design_analysis: Dict) -> Dict:
        """Detect what interactive elements are in the design"""
        elements = design_analysis.get('elements', {})
        
        detected = {
            "has_forms": False,
            "has_buttons": False,
            "has_navigation": False,
            "has_inputs": False,
            "has_images": False,
            "has_cards": False,
            "has_tables": False,
            "has_search": False,
            "has_login": False,
            "has_contact": False
        }
        
        # Check for forms
        if elements.get('forms') or elements.get('buttons'):
            detected["has_forms"] = True
            
        # Check for buttons
        if elements.get('buttons'):
            detected["has_buttons"] = True
            
        # Check for navigation
        if elements.get('navigation') or any('nav' in str(el).lower() 
                                           for el in elements.get('text', [])):
            detected["has_navigation"] = True
            
        # Check for inputs/search
        if any('search' in str(el).lower() or 'input' in str(el).lower()
              for el in elements.get('text', [])):
            detected["has_search"] = True
            detected["has_inputs"] = True
            
        # Check for login/contact forms
        text_contents = [el.get('content', '').lower() 
                        for el in elements.get('text', [])]
        if any('login' in text or 'sign in' in text for text in text_contents):
            detected["has_login"] = True
        if any('contact' in text or 'email' in text for text in text_contents):
            detected["has_contact"] = True
            
        # Check for images
        if elements.get('images'):
            detected["has_images"] = True
            
        # Check for cards
        if elements.get('containers') or any('card' in str(el).lower()
                                           for el in elements.get('text', [])):
            detected["has_cards"] = True
            
        return detected

    def _format_interactive_detection(self, detected: Dict) -> str:
        """Format detected interactive elements for prompt"""
        features = []
        
        if detected["has_forms"]:
            features.append("✅ Forms detected - will implement validation & submission")
        if detected["has_buttons"]:
            features.append("✅ Buttons detected - will add click handlers & feedback")
        if detected["has_navigation"]:
            features.append("✅ Navigation detected - will implement smooth scrolling/page navigation")
        if detected["has_inputs"]:
            features.append("✅ Input fields detected - will add validation & user feedback")
        if detected["has_search"]:
            features.append("✅ Search bar detected - will implement live search filtering")
        if detected["has_login"]:
            features.append("✅ Login form detected - will implement mock authentication")
        if detected["has_contact"]:
            features.append("✅ Contact form detected - will implement form submission")
        if detected["has_images"]:
            features.append("✅ Images detected - will add lightbox/zoom functionality")
        if detected["has_cards"]:
            features.append("✅ Cards detected - will add hover effects & click actions")
            
        if not features:
            features.append("⚠️ Basic design - will implement core functionality with working buttons/forms")
            
        return "\n".join(features)


    # -----------------------------
    # IMAGE HANDLING (FIX FOR BASE64)
    # -----------------------------
    def _save_base64_to_tempfile(self, data_url: str):
        """Save large base64 image to a temp file to avoid sending huge blobs to OpenRouter."""
        try:
            header, encoded = data_url.split(",", 1)
            raw = base64.b64decode(encoded)
        except Exception:
            return None

        if "png" in header:
            ext = ".png"
        elif "jpeg" in header or "jpg" in header:
            ext = ".jpg"
        else:
            ext = ".bin"

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        tmp.write(raw)
        tmp.close()
        return tmp.name

    def _shrink_images_in_design(self, design_data: Dict[str, Any], max_bytes=200000):
        """
        Replace very large base64 images with a short placeholder path (__SAVED_FILE__:path).
        Prevents API crashing due to huge base64 strings.
        """
        images = design_data.get("images") or []
        new_images = []

        for img in images:
            src = img.get("src")

            # Only shrink data URLs (base64)
            if isinstance(src, str) and src.startswith("data:"):
                approx_size = len(src)

                # Image too big → Save locally
                if approx_size > max_bytes:
                    saved_path = self._save_base64_to_tempfile(src)
                    if saved_path:
                        new_images.append({
                            "id": img.get("id"),
                            "src": f"__SAVED_FILE__:{saved_path}",
                            "width": img.get("width"),
                            "height": img.get("height"),
                            "type": img.get("type")
                        })
                        continue

            # If small image → keep original
            new_images.append(img)

        design_data["images"] = new_images
        return design_data

    def extract_json_from_response(self, content):
        if content.strip().startswith('```json'):
            lines = content.strip().split('\n')
            json_content = '\n'.join(lines[1:-1])
            return json_content.strip()
        else:
            return content.strip()

    def call_ai_api(self, prompt, model="deepseek/deepseek-chat"):
        headers = {
            "content-type": "application/json",
            "authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://whiteboard2web.com",
            "X-Title": "Whiteboard2Web Functional Generator"
        }

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": """You are a senior full-stack developer who creates COMPLETE, 
                    FUNCTIONAL, PRODUCTION-READY websites. EVERY element must work. 
                    Forms must validate and submit. Buttons must have click handlers. 
                    Navigation must work. Generate multiple HTML files if design has 
                    multiple sections. Return valid JSON with project_structure array."""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 6000,  # Increased for complex projects
            "temperature": 0.5,
            "top_p": 0.9
        }

        try:
            response = requests.post(self.base_url, headers=headers, json=payload, timeout=30)

            if response.status_code == 200:
                return response.json()
            else:
                print(f"API Error: {response.status_code} - {response.text}")
                return None

        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return None

    def generate_code(self, design_data, user_request) -> Dict[str, Any]:
        if not self.api_key:
            return self._get_functional_fallback("API key not configured")
                # Shrink large images before sending to OpenRouter
        design_data = self._shrink_images_in_design(design_data)


        prompt = self.create_code_generation_prompt(design_data, user_request)
        print("🚀 Sending request to AI for FUNCTIONAL code generation...")
        print(f"📝 User request: {user_request}")

        ai_response = self.call_ai_api(prompt)

        if ai_response and 'choices' in ai_response:
            content = ai_response['choices'][0]['message']['content']
            print("✅ AI response received")
            
            try:
                clean_content = self.extract_json_from_response(content)
                code_data = json.loads(clean_content)
                print("✅ JSON parsed successfully")
                
                # Ensure required fields exist
                # Fix: also detect empty or incomplete project_structure
                if (
                    'project_structure' not in code_data or
                    not code_data['project_structure'] or
                    not any(f.get("file") == "index.html" for f in code_data['project_structure'])
                ):
                    code_data = self._convert_to_project_structure(code_data)

                
                # Add functional features list if not present
                if 'functional_features' not in code_data:
                    code_data['functional_features'] = self._infer_functional_features(code_data)
                
                # Add instructions if not present
                if 'instructions' not in code_data:
                    code_data['instructions'] = self._generate_instructions(code_data)
                
                print(f"📁 Generated {len(code_data.get('project_structure', []))} files")
                print(f"⚡ Functional features: {code_data.get('functional_features', [])}")
                
                return code_data
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON parsing failed: {e}")
                
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    try:
                        extracted_json = json_match.group()
                        code_data = json.loads(extracted_json)
                        print("✅ JSON extracted from response")
                        return code_data

                    except json.JSONDecodeError:
                        pass
                
                # Return functional fallback
                return self._get_functional_fallback(f"JSON parsing error: {str(e)}", content)
        
        print("❌ No response from AI API")
        return self._get_functional_fallback("AI service unavailable")

    def _convert_to_project_structure(self, code_data: Dict) -> Dict:
        """Convert old format to new project_structure format"""
        project_structure = []
        
        # Add HTML
        if 'html' in code_data:
            project_structure.append({
                "file": "index.html",
                "content": code_data['html']
            })
            code_data['main_html'] = code_data['html']
        
        # Add CSS
        if 'css' in code_data:
            project_structure.append({
                "file": "styles.css",
                "content": code_data['css']
            })
            code_data['main_css'] = code_data['css']
        
        # Add JavaScript
        if 'javascript' in code_data:
            project_structure.append({
                "file": "script.js",
                "content": code_data['javascript']
            })
            code_data['main_js'] = code_data['javascript']
        
        code_data['project_structure'] = project_structure
        return code_data

    def _infer_functional_features(self, code_data: Dict) -> List[str]:
        """Infer functional features from generated code"""
        features = ["responsive"]
        
        js_content = code_data.get('main_js', '') or ''
        html_content = code_data.get('main_html', '') or ''
        
        # Check for form functionality
        if 'addEventListener' in js_content and ('submit' in js_content or 'click' in js_content):
            features.append("forms")
        
        # Check for button functionality
        if 'querySelector' in js_content and 'click' in js_content:
            features.append("buttons")
        
        # Check for navigation
        if 'scroll' in js_content or 'href' in js_content:
            features.append("navigation")
        
        # Check for modals
        if 'modal' in js_content.lower() or 'showModal' in js_content:
            features.append("modals")
        
        # Check for validation
        if 'validate' in js_content or 'checkValidity' in js_content:
            features.append("validation")
        
        # Check for localStorage
        if 'localStorage' in js_content:
            features.append("persistence")
        
        return features

    def _generate_instructions(self, code_data: Dict) -> str:
        """Generate instructions for running the code"""
        features = code_data.get('functional_features', [])
        
        instructions = "To run this website:\n"
        instructions += "1. Save all files in the same directory\n"
        instructions += "2. Open index.html in a web browser\n"
        instructions += "3. All features should work:\n"
        
        if "forms" in features:
            instructions += "   • Forms can be submitted (check console for data)\n"
        if "buttons" in features:
            instructions += "   • Buttons have click handlers with feedback\n"
        if "navigation" in features:
            instructions += "   • Navigation links work (smooth scrolling/page nav)\n"
        if "validation" in features:
            instructions += "   • Form validation provides real-time feedback\n"
        
        return instructions

    def _get_functional_fallback(self, error_message: str, raw_content: str = "") -> Dict:
        """Return a functional fallback website"""
        return {
            "project_structure": [
                {
                    "file": "index.html",
                    "content": self._get_basic_functional_html()
                },
                {
                    "file": "styles.css",
                    "content": self._get_basic_functional_css()
                },
                {
                    "file": "script.js",
                    "content": self._get_basic_functional_js()
                }
            ],
            "main_html": self._get_basic_functional_html(),
            "main_css": self._get_basic_functional_css(),
            "main_js": self._get_basic_functional_js(),
            "explanation": f"Functional fallback template - {error_message}",
            "layout_type": "fallback-functional",
            "functional_features": ["responsive", "forms", "buttons", "navigation", "validation"],
            "instructions": "Open index.html in browser. All buttons work, form validates and submits.",
            "notes": error_message
        }

    def _get_basic_functional_html(self) -> str:
        return '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Functional Website | Whiteboard2Web</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="header">
        <nav class="navbar">
            <div class="logo">YourLogo</div>
            <div class="nav-links">
                <a href="#home" class="nav-link active">Home</a>
                <a href="#about" class="nav-link">About</a>
                <a href="#services" class="nav-link">Services</a>
                <a href="#contact" class="nav-link">Contact</a>
            </div>
            <button class="menu-toggle">☰</button>
        </nav>
    </header>

    <main class="container">
        <section class="hero" id="home">
            <h1>Welcome to Your Functional Website</h1>
            <p>Everything works - buttons, forms, navigation!</p>
            <div class="cta-buttons">
                <button class="btn btn-primary" id="primaryBtn">Primary Button</button>
                <button class="btn btn-secondary" id="secondaryBtn">Secondary Button</button>
                <button class="btn btn-outline" id="outlineBtn">Outline Button</button>
            </div>
        </section>

        <section class="form-section" id="contact">
            <h2>Working Contact Form</h2>
            <form id="contactForm">
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name" required 
                           placeholder="Enter your name">
                    <div class="error-message" id="nameError"></div>
                </div>
                
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" required 
                           placeholder="Enter your email">
                    <div class="error-message" id="emailError"></div>
                </div>
                
                <div class="form-group">
                    <label for="message">Message:</label>
                    <textarea id="message" name="message" required 
                              placeholder="Your message..."></textarea>
                    <div class="error-message" id="messageError"></div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-submit">Send Message</button>
                    <button type="reset" class="btn btn-reset">Clear</button>
                </div>
                
                <div class="form-status" id="formStatus"></div>
            </form>
        </section>

        <section class="interactive-section">
            <h2>Interactive Features</h2>
            
            <div class="feature-cards">
                <div class="card" id="card1">
                    <h3>Click Me</h3>
                    <p>Click count: <span class="click-count">0</span></p>
                    <button class="card-btn">Click to Count</button>
                </div>
                
                <div class="card" id="card2">
                    <h3>Toggle Me</h3>
                    <p class="toggle-state">Currently: OFF</p>
                    <button class="toggle-btn">Toggle</button>
                </div>
                
                <div class="card" id="card3">
                    <h3>Color Changer</h3>
                    <div class="color-box" id="colorBox"></div>
                    <button class="color-btn">Change Color</button>
                </div>
            </div>
        </section>
    </main>

    <footer class="footer">
        <p>© 2024 Whiteboard2Web - All features functional</p>
    </footer>

    <div class="notification" id="notification">
        <span class="notification-message"></span>
    </div>

    <script src="script.js"></script>
</body>
</html>'''

    def _get_basic_functional_css(self) -> str:
        return '''/* Functional CSS - Everything Works! */
:root {
    --primary: #4361ee;
    --secondary: #3a0ca3;
    --success: #4cc9f0;
    --danger: #f72585;
    --light: #f8f9fa;
    --dark: #212529;
    --gray: #6c757d;
    --shadow: 0 4px 12px rgba(0,0,0,0.1);
    --radius: 8px;
    --transition: all 0.3s ease;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: var(--dark);
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    min-height: 100vh;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header & Navigation */
.header {
    background: white;
    box-shadow: var(--shadow);
    position: sticky;
    top: 0;
    z-index: 1000;
}

.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    max-width: 1200px;
    margin: 0 auto;
}

.logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--primary);
}

.nav-links {
    display: flex;
    gap: 2rem;
}

.nav-link {
    text-decoration: none;
    color: var(--gray);
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    transition: var(--transition);
}

.nav-link:hover,
.nav-link.active {
    color: var(--primary);
    background: rgba(67, 97, 238, 0.1);
}

.menu-toggle {
    display: none;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--primary);
}

/* Buttons */
.btn {
    padding: 0.8rem 1.5rem;
    border: none;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}

.btn:active {
    transform: translateY(0);
}

.btn-primary {
    background: var(--primary);
    color: white;
}

.btn-primary:hover {
    background: #3a56d4;
}

.btn-secondary {
    background: var(--secondary);
    color: white;
}

.btn-outline {
    background: transparent;
    color: var(--primary);
    border: 2px solid var(--primary);
}

.btn-outline:hover {
    background: rgba(67, 97, 238, 0.1);
}

.btn-submit {
    background: var(--success);
    color: white;
}

.btn-reset {
    background: var(--gray);
    color: white;
}

/* Hero Section */
.hero {
    text-align: center;
    padding: 4rem 0;
}

.hero h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: var(--dark);
}

.hero p {
    font-size: 1.2rem;
    color: var(--gray);
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}

.cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

/* Forms */
.form-section {
    background: white;
    padding: 3rem;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    margin: 2rem auto;
    max-width: 600px;
}

.form-section h2 {
    margin-bottom: 2rem;
    color: var(--dark);
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--dark);
}

.form-group input,
.form-group textarea {
    width: 100%;
    padding: 0.8rem;
    border: 2px solid #e0e0e0;
    border-radius: var(--radius);
    font-size: 1rem;
    transition: var(--transition);
}

.form-group input:focus,
.form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.1);
}

.form-group input.error,
.form-group textarea.error {
    border-color: var(--danger);
}

.error-message {
    color: var(--danger);
    font-size: 0.9rem;
    margin-top: 0.5rem;
    min-height: 1.2rem;
}

.form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
}

.form-status {
    margin-top: 1rem;
    padding: 1rem;
    border-radius: var(--radius);
    display: none;
}

.form-status.success {
    display: block;
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.form-status.error {
    display: block;
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

/* Interactive Cards */
.interactive-section {
    padding: 3rem 0;
}

.interactive-section h2 {
    text-align: center;
    margin-bottom: 2rem;
    color: var(--dark);
}

.feature-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    max-width: 1000px;
    margin: 0 auto;
}

.card {
    background: white;
    padding: 2rem;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    text-align: center;
    transition: var(--transition);
}

.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.card h3 {
    margin-bottom: 1rem;
    color: var(--primary);
}

.card-btn,
.toggle-btn,
.color-btn {
    margin-top: 1rem;
    width: 100%;
}

.color-box {
    width: 100%;
    height: 100px;
    background: var(--primary);
    border-radius: var(--radius);
    margin: 1rem 0;
    transition: var(--transition);
}

/* Notification */
.notification {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: var(--primary);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    transform: translateY(100px);
    opacity: 0;
    transition: var(--transition);
    z-index: 2000;
}

.notification.show {
    transform: translateY(0);
    opacity: 1;
}

/* Footer */
.footer {
    text-align: center;
    padding: 2rem;
    margin-top: 3rem;
    background: white;
    color: var(--gray);
    border-top: 1px solid #e0e0e0;
}

/* Responsive */
@media (max-width: 768px) {
    .hero h1 {
        font-size: 2rem;
    }
    
    .nav-links {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        flex-direction: column;
        padding: 1rem;
        box-shadow: var(--shadow);
    }
    
    .nav-links.active {
        display: flex;
    }
    
    .menu-toggle {
        display: block;
    }
    
    .cta-buttons {
        flex-direction: column;
        align-items: center;
    }
    
    .form-section {
        padding: 2rem;
    }
}'''

    def _get_basic_functional_js(self) -> str:
        return '''// COMPLETE FUNCTIONAL JAVESCRIPT - EVERYTHING WORKS!

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Website loaded - all features functional');
    
    // Initialize all features
    initNavigation();
    initButtons();
    initForms();
    initCards();
    initNotification();
});

// 1. Navigation with smooth scrolling
function initNavigation() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-link');
    
    // Mobile menu toggle
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            console.log('📱 Mobile menu toggled');
        });
    }
    
    // Smooth scrolling for navigation links
    navItems.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    // Update active state
                    navItems.forEach(item => item.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Smooth scroll
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                    
                    console.log(`🔗 Scrolled to ${targetId}`);
                }
            }
        });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.navbar') && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
        }
    });
}

// 2. Button functionality
function initButtons() {
    const primaryBtn = document.getElementById('primaryBtn');
    const secondaryBtn = document.getElementById('secondaryBtn');
    const outlineBtn = document.getElementById('outlineBtn');
    
    // Primary button - shows notification
    if (primaryBtn) {
        primaryBtn.addEventListener('click', function() {
            console.log('🟦 Primary button clicked');
            showNotification('Primary button clicked! Action performed.');
            
            // Visual feedback
            this.classList.add('pulse');
            setTimeout(() => this.classList.remove('pulse'), 300);
        });
    }
    
    // Secondary button - changes color
    if (secondaryBtn) {
        let clickCount = 0;
        secondaryBtn.addEventListener('click', function() {
            clickCount++;
            console.log(`🟪 Secondary button clicked ${clickCount} times`);
            
            // Cycle through colors
            const colors = ['#4361ee', '#3a0ca3', '#7209b7', '#560bad'];
            this.style.backgroundColor = colors[clickCount % colors.length];
            this.textContent = `Clicked ${clickCount} times`;
            
            showNotification(`Secondary button count: ${clickCount}`);
        });
    }
    
    // Outline button - toggles class
    if (outlineBtn) {
        outlineBtn.addEventListener('click', function() {
            console.log('⬜ Outline button clicked');
            document.body.classList.toggle('dark-mode');
            
            if (document.body.classList.contains('dark-mode')) {
                document.body.style.background = '#1a1a2e';
                document.body.style.color = '#f0f0f0';
                showNotification('Dark mode activated');
            } else {
                document.body.style.background = '';
                document.body.style.color = '';
                showNotification('Light mode activated');
            }
        });
    }
}

// 3. Form functionality with validation
function initForms() {
    const contactForm = document.getElementById('contactForm');
    
    if (!contactForm) return;
    
    // Real-time validation
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    
    // Name validation
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            const nameError = document.getElementById('nameError');
            if (this.value.length < 2) {
                this.classList.add('error');
                nameError.textContent = 'Name must be at least 2 characters';
            } else {
                this.classList.remove('error');
                nameError.textContent = '';
            }
        });
    }
    
    // Email validation
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            const emailError = document.getElementById('emailError');
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            
            if (!emailRegex.test(this.value)) {
                this.classList.add('error');
                emailError.textContent = 'Please enter a valid email';
            } else {
                this.classList.remove('error');
                emailError.textContent = '';
            }
        });
    }
    
    // Message validation
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            const messageError = document.getElementById('messageError');
            if (this.value.length < 10) {
                this.classList.add('error');
                messageError.textContent = 'Message must be at least 10 characters';
            } else {
                this.classList.remove('error');
                messageError.textContent = '';
            }
        });
    }
    
    // Form submission
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('📝 Form submission started');
        
        // Validate all fields
        const nameValid = nameInput.value.length >= 2;
        const emailValid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailInput.value);
        const messageValid = messageInput.value.length >= 10;
        
        if (nameValid && emailValid && messageValid) {
            // Show loading state
            const submitBtn = contactForm.querySelector('.btn-submit');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            
            // Simulate API call
            setTimeout(() => {
                // Reset button
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                
                // Show success message
                const formStatus = document.getElementById('formStatus');
                formStatus.textContent = 'Message sent successfully! Check console for data.';
                formStatus.className = 'form-status success';
                
                // Log form data
                const formData = {
                    name: nameInput.value,
                    email: emailInput.value,
                    message: messageInput.value,
                    timestamp: new Date().toISOString()
                };
                console.log('📨 Form submitted:', formData);
                
                showNotification('Message sent successfully!');
                
                // Reset form after 3 seconds
                setTimeout(() => {
                    contactForm.reset();
                    formStatus.textContent = '';
                    formStatus.className = 'form-status';
                }, 3000);
                
            }, 1500);
        } else {
            // Show error
            const formStatus = document.getElementById('formStatus');
            formStatus.textContent = 'Please fix errors before submitting.';
            formStatus.className = 'form-status error';
            showNotification('Please fix form errors');
        }
    });
    
    // Form reset
    contactForm.addEventListener('reset', function() {
        console.log('🔄 Form reset');
        document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        const formStatus = document.getElementById('formStatus');
        formStatus.textContent = '';
        formStatus.className = 'form-status';
        showNotification('Form cleared');
    });
}

// 4. Interactive cards
function initCards() {
    // Card 1 - Click counter
    const card1Btn = document.querySelector('#card1 .card-btn');
    const clickCountElement = document.querySelector('#card1 .click-count');
    
    if (card1Btn && clickCountElement) {
        let clickCount = 0;
        card1Btn.addEventListener('click', function() {
            clickCount++;
            clickCountElement.textContent = clickCount;
            console.log(`🃏 Card 1 clicked ${clickCount} times`);
            this.textContent = `Clicked ${clickCount}`;
            
            // Visual feedback
            const card = this.closest('.card');
            card.style.transform = 'scale(0.95)';
            setTimeout(() => card.style.transform = '', 200);
        });
    }
    
    // Card 2 - Toggle
    const card2Btn = document.querySelector('#card2 .toggle-btn');
    const toggleStateElement = document.querySelector('#card2 .toggle-state');
    
    if (card2Btn && toggleStateElement) {
        let isOn = false;
        card2Btn.addEventListener('click', function() {
            isOn = !isOn;
            toggleStateElement.textContent = `Currently: ${isOn ? 'ON' : 'OFF'}`;
            this.textContent = isOn ? 'Turn OFF' : 'Turn ON';
            this.style.backgroundColor = isOn ? '#4cc9f0' : '';
            
            console.log(`🔘 Card 2 toggled to ${isOn ? 'ON' : 'OFF'}`);
            showNotification(`Toggled ${isOn ? 'ON' : 'OFF'}`);
        });
    }
    
    // Card 3 - Color changer
    const card3Btn = document.querySelector('#card3 .color-btn');
    const colorBox = document.getElementById('colorBox');
    
    if (card3Btn && colorBox) {
        const colors = ['#4361ee', '#f72585', '#4cc9f0', '#7209b7', '#560bad', '#b5179e'];
        let colorIndex = 0;
        
        card3Btn.addEventListener('click', function() {
            colorIndex = (colorIndex + 1) % colors.length;
            colorBox.style.backgroundColor = colors[colorIndex];
            this.textContent = `Color ${colorIndex + 1}`;
            
            console.log(`🎨 Changed color to ${colors[colorIndex]}`);
            showNotification(`Color changed to ${colors[colorIndex]}`);
        });
    }
}

// 5. Notification system
function initNotification() {
    window.showNotification = function(message, duration = 3000) {
        const notification = document.getElementById('notification');
        const messageElement = notification.querySelector('.notification-message');
        
        if (notification && messageElement) {
            messageElement.textContent = message;
            notification.classList.add('show');
            
            console.log(`💬 Notification: ${message}`);
            
            // Auto-hide after duration
            setTimeout(() => {
                notification.classList.remove('show');
            }, duration);
        }
    };
}

// Add CSS for pulse animation
const style = document.createElement('style');
style.textContent = `
    .pulse {
        animation: pulse 0.3s ease;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .dark-mode .card,
    .dark-mode .form-section {
        background: #2d2d44;
        color: #f0f0f0;
    }
`;
document.head.appendChild(style);

console.log('✅ All JavaScript functions initialized');'''

# Test code - keep this for debugging
if __name__ == "__main__":
    print("🧪 Testing Functional AIDesignAssistant...")
    
    # Create instance
    assistant = AIdesignAssistant()
    
    # Test with minimal design
    test_design = {
        "design_analysis": {
            "elements": {
                "text": [
                    {"content": "Welcome", "type": "heading"},
                    {"content": "Submit", "type": "button"}
                ],
                "buttons": [{"type": "button", "content": "Click me"}],
                "forms": [{"type": "input", "label": "Email"}]
            },
            "layout": {"rows": 1},
            "styles": {"colors": ["#4361ee", "#ffffff"]}
        },
        "canvas_data": {}
    }
    
    result = assistant.generate_code(test_design, "Create a functional website")
    print(f"Generated {len(result.get('project_structure', []))} files")
    print(f"Features: {result.get('functional_features', [])}")