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
        design_analysis = design_data.get('design_analysis', {})
        interactive_elements = self._detect_interactive_elements(design_analysis)

        prompt = f"""
    You are a strict professional front-end web developer.  
    You must generate code that **matches the drawn design EXACTLY** with:

    🎯 **Same layout**
    🎨 **Same colors**
    📏 **Same spacing and sizes**
    🔤 **Same fonts, alignments, proportions**
    🖼️ **Same images (using provided paths)**

    ❌ Do NOT redesign
    ❌ Do NOT optimize visually
    ❌ Do NOT change spacing, colors, UI components, layout, fonts
    ❌ Do NOT add creative variations

    # DESIGN ANALYSIS (INPUT — FOLLOW EXACTLY):
    {json.dumps(design_analysis, indent=2)}

    # REQUIRED FUNCTIONALITY (ONLY from detected elements):
    {self._format_interactive_detection(interactive_elements)}

    # USER REQUEST:
    {user_request}

    # OUTPUT RULES (STRICT):
    - Generate a REAL working website
    - Use HTML + CSS + JavaScript (separate files)
    - If layout shows multiple pages, generate multiple HTML files
    - All JavaScript must be working (NO placeholder code)
    - Keep all spacing & exact UI structure

    # IMAGE REQUIREMENTS:
    - Use provided image file names EXACTLY (do not rename)
    - If an image exists, include it in correct size & proportion
    - Use <img src="FILENAME.ext"> only (no base64)

    # OUTPUT FORMAT (RETURN VALID JSON ONLY):
    {{
    "project_structure": [
        {{"file": "index.html", "content": "COMPLETE HTML"}},
        {{"file": "styles.css", "content": "COMPLETE CSS"}},
        {{"file": "script.js", "content": "COMPLETE JAVASCRIPT"}}
    ],
    "main_html": "index.html content ONLY",
    "main_css": "styles.css content ONLY",
    "main_js": "script.js content ONLY",
    "explanation": "Functional description only. NO design changes.",
    "layout_type": "Describe structure (grid, flex, stacked, sidebar, navbar, etc.)",
    "functional_features": ["button clicks", "form validation", "navigation", etc],
    "instructions": "How to run and test features in a browser"
    }}

    💡 **Do not include backticks, code fences, or markdown formatting in the JSON.**
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
