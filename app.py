from flask import Flask, request, jsonify
import joblib
import numpy as np
from flask_cors import CORS
app = Flask(__name__)


CORS(app)

model = joblib.load("churn_model.pkl")
scaler = joblib.load("scaler.pkl")



@app.route("/")
def home():
    return "API Running"

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        # ✅ safe validation
        if not data or "features" not in data:
            return jsonify({
                "error": "Missing or invalid 'features' key"
            }), 400

        features = np.array(data["features"])

        if len(features) == 0:
            return jsonify({
                "error": "Empty features"
            }), 400

        features = features.reshape(1, -1)

        scaled = scaler.transform(features)

        prediction = model.predict(scaled)[0]
        probability = model.predict_proba(scaled)[0][1]

        return jsonify({
            "prediction": int(prediction),
            "probability": float(probability)
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500
import joblib
feature_names = joblib.load("features.pkl")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)