from flask import Flask, request, jsonify
import joblib
import numpy as np
from flask_cors import CORS
app = Flask(__name__)


CORS(app)

model = joblib.load("churn_model.pkl")
scaler = joblib.load("scaler.pkl")



@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        raw = data["features"]

        # Map EXACT order of training features
        features = np.array([[
            raw["TotalCharges"],
            raw["AvgChargePerMonth"],
            raw["tenure"],
            raw["MonthlyCharges"],
            raw["Contract_Month-to-month"],
            raw["OnlineSecurity_No"],
            raw["PaymentMethod_Electronic check"],
            raw["TechSupport_No"],
            raw["gender"],
            raw["PaperlessBilling"],
            raw["InternetService_Fiber optic"],
            raw["Partner"],
            raw["Contract_Two year"],
            raw["OnlineBackup_No"],
            raw["Dependents"]
        ]])

        scaled = scaler.transform(features)

        prediction = model.predict(scaled)[0]
        probability = model.predict_proba(scaled)[0][1]

        return jsonify({
            "prediction": int(prediction),
            "probability": float(probability)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
import joblib
feature_names = joblib.load("features.pkl")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)