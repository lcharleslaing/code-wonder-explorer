import React from "react";

export default function Settings() {
  return (
    <div style={{
      maxWidth: 600,
      margin: "40px auto",
      padding: 32,
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      fontFamily: 'Roboto, Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Settings</h1>
      <p style={{ fontSize: 16, color: '#444', marginBottom: 24 }}>
        This is the settings page. Here you will be able to:
      </p>
      <ul style={{ fontSize: 16, color: '#333', lineHeight: 2, paddingLeft: 24 }}>
        <li>Update your account information</li>
        <li>Change your password</li>
        <li>Configure notification preferences</li>
        <li>Manage integrations and connected services</li>
        <li>Set application appearance and theme</li>
        <li>And more coming soon...</li>
      </ul>
    </div>
  );
}