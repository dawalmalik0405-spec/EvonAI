import ai_service
from flask import Flask, request, jsonify, render_template, session, redirect
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
import datetime

app = Flask(__name__, static_folder="static", template_folder="templates")

app.secret_key = "supersecretkey"   # REQUIRED for login sessions

CORS(app)

ai_assistant = ai_service.AIdesignAssistant()

# -------------------------------
# 🚀 PUBLIC LANDING PAGE (Home)
# -------------------------------
@app.route('/')
def root():
    return render_template("home.html")  # always open home page


# -------------------------------
# 🔐 ONLY logged-in users can access index.html (whiteboard)
# -------------------------------
@app.route('/index.html')
def index_html():
    if "user_id" not in session:
        return redirect("/login")
    return render_template('index.html')


# -------------------------------
# 🔐 Login Page (public)
# -------------------------------
@app.route("/login")
def login_page():
    return render_template("login.html")


# -------------------------------
# 🏠 After login, load home.html again (but now user is logged in)
# -------------------------------
@app.route("/home")
def home_page():
    return render_template("home.html", logged_in=("user_id" in session))





# -------------------------------
# 🛠 SIGN UP
# -------------------------------
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if users_col.find_one({"email": email}):
        return jsonify({"success": False, "message": "Email already exists"})

    hashed = generate_password_hash(password)

    user_id = users_col.insert_one({
        "name": name,
        "email": email,
        "password": hashed,
        "created_at": datetime.datetime.utcnow()
    }).inserted_id

    session["user_id"] = str(user_id)
    return jsonify({"success": True, "redirect": "/home"})


# -------------------------------
# 🔑 LOGIN
# -------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user = users_col.find_one({"email": email})

    if not user:
        return jsonify({"success": False, "message": "User not found"})

    if not check_password_hash(user["password"], password):
        return jsonify({"success": False, "message": "Incorrect password"})

    # login success
    session["user_id"] = str(user["_id"])
    return jsonify({"success": True, "redirect": "/home"})


# -------------------------------
# 🚪 LOGOUT
# -------------------------------
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")


# --------------------------------------
# ✨ AI CODE GENERATION (unchanged)
# --------------------------------------
@app.route('/api/generated', methods=['POST'])
def generate_code_endpoint():
    if not request.json:
        return jsonify({"error": "No JSON data provided"}), 400

    design_data = request.json.get('design_data', {})
    user_prompt = request.json.get('user_prompt', '')

    if not user_prompt:
        return jsonify({"error": "user_prompt is required"}), 400

    result = ai_assistant.generate_code(design_data, user_prompt)

    if result is None:
        return jsonify({"error": "Failed to generate code"}), 500
    return jsonify({"success": True, "code": result}), 200


@app.route('/health')
def health_check():
    return jsonify({"status": "ok"})


@app.route('/api/test', methods=['POST'])
def test_connection():
    return jsonify({"status": "connected"})


@app.route('/code-display')
def code_display():
    return render_template('code_display.html')


@app.route('/api/save-code', methods=['POST'])
def save_code():
    try:
        session['generated_code'] = request.json.get('code_data', {})
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/projects/save", methods=["POST"])
def save_project():
    if "user_id" not in session:
        return jsonify({"success": False, "message": "Unauthorized"})

    data = request.json
    project_id = data.get("project_id")
    title = data.get("title")
    design = data.get("design")

    # UPDATE existing project
    if project_id:
        projects_col.update_one(
            {"_id": ObjectId(project_id)},
            {"$set": {
                "title": title,
                "design": design,
                "updated_at": datetime.datetime.utcnow()
            }}
        )
        return jsonify({"success": True, "project_id": project_id})

    # CREATE new project
    new_id = projects_col.insert_one({
        "user_id": session["user_id"],
        "title": title,
        "design": design,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow()
    }).inserted_id

    return jsonify({"success": True, "project_id": str(new_id)})

@app.route("/api/projects", methods=["GET"])
def get_projects():
    if "user_id" not in session:
        return jsonify({"success": False, "projects": []})

    projects = list(projects_col.find({"user_id": session["user_id"]}))
    for p in projects:
        p["_id"] = str(p["_id"])
    return jsonify({"success": True, "projects": projects})


@app.route("/api/projects/<project_id>", methods=["GET"])
def load_project(project_id):
    project = projects_col.find_one({"_id": ObjectId(project_id)})
    if not project:
        return jsonify({"success": False, "message": "Not found"})

    project["_id"] = str(project["_id"])
    return jsonify({"success": True, "project": project})

@app.route("/api/projects/list", methods=["GET"])
def list_projects():
    projects = list(db.projects.find({}, {"title": 1}))
    
    result = [
        {
            "project_id": str(p["_id"]),
            "title": p.get("title", "Untitled Project")
        }
        for p in projects
    ]

    return jsonify({"success": True, "projects": result})














# --------------------------------------
# 🗂 MongoDB Connection
# --------------------------------------
mongo = MongoClient("mongodb+srv://Mdsaifali:Saif6343@saif1.n5mqz1l.mongodb.net/whiteboard2web")
db = mongo["whiteboard2web"]
users_col = db["users"]
projects_col = db["projects"]

# --------------------------------------
# RUN SERVER
# --------------------------------------
if __name__ == '__main__':
    app.run(debug=True, port=5000)
