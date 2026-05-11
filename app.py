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

    data = request.json

    features = np.array(data["features"]).reshape(1, -1)

    scaled = scaler.transform(features)

    prediction = model.predict(scaled)[0]

    probability = model.predict_proba(scaled)[0][1]

    return jsonify({
        "prediction": int(prediction),
        "probability": float(probability)
    })
import joblib
feature_names = joblib.load("features.pkl")

if __name__ == "__main__":
    app.run(debug=True)