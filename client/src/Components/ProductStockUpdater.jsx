import React, { useState } from "react";

function ProductStockUpdater({ productId, currentStock }) {
  const [newStock, setNewStock] = useState("");
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState(false);
  const [stock, setStock] = useState(currentStock);

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setMessage("");
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStock: Number(newStock) }),
      });
      const data = await res.json();
      if (data.success) {
        setStock(data.data.stock);
        setMessage(`Stock updated! New stock: ${data.data.stock}`);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      setMessage("Network error");
    }
    setNewStock("");
    setUpdating(false);
  };

  return (
    <form onSubmit={handleUpdateStock} style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      <div>
        <label>Current Stock: </label>
        <span>{stock}</span>
      </div>
      <input
        type="number"
        value={newStock}
        onChange={(e) => setNewStock(e.target.value)}
        placeholder="New stock"
        min="1"
        required
      />
      <button type="submit" disabled={updating}>Update Stock</button>
      {message && <span>{message}</span>}
    </form>
  );
}

export default ProductStockUpdater;
