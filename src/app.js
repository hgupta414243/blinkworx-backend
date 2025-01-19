const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "ecommerce",
  port: 5432,
});

app.use(cors());
app.use(express.json());

const insertInitialData = async () => {
  const products = [
    {
      id: 1,
      productName: "HP laptop",
      productDescription: "This is HP laptop",
    },
    {
      id: 2,
      productName: "lenovo laptop",
      productDescription: "This is lenovo",
    },
    { id: 3, productName: "Car", productDescription: "This is Car" },
    { id: 4, productName: "Bike", productDescription: "This is Bike" },
  ];

  const query = `
    INSERT INTO Products (Id, productName, productDescription)
    VALUES ($1, $2, $3)
    ON CONFLICT (Id) DO NOTHING;
  `;

  try {
    for (const product of products) {
      await pool.query(query, [
        product.id,
        product.productName,
        product.productDescription,
      ]);
    }
    console.log("Initial product data inserted.");
  } catch (err) {
    console.error("Error inserting product data:", err);
  }
};
insertInitialData();
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM PRODUCTS");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/order", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM ORDERS");
    const orderMaps = await pool.query(
      "SELECT orderId, COUNT(productId) AS productCount FROM OrderProductMap GROUP BY orderId ORDER BY orderId"
    );
    const resData = result.rows.map((data) => {
      const res = orderMaps.rows.find((val) => val?.orderid === data?.id);
      if (res) {
        return {
          id: data?.id,
          orderdescription: data?.orderdescription,
          createdat: data?.createdat,
          productcount: res?.productcount,
        };
      }
    });
    res.json(resData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/order/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM ORDERS WHERE Id = $1", [id]);

    const orderMap = await pool.query(
      "SELECT orderId, COUNT(productId) AS productCount FROM OrderProductMap WHERE orderId = $1 GROUP BY orderId ORDER BY orderId",
      [id]
    );
    const resData = orderMap.rows.map((data) => {
      const res = result.rows.find((val) => val?.id === data?.orderid);
      if (res) {
        return {
          id: data?.id,
          orderdescription: data?.orderdescription,
          createdat: data?.createdat,
          productcount: res?.productcount,
        };
      }
    });

    console.log('resData',resData);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/orders", async (req, res) => {
  const { orderDescription, products } = req.body;
  try {
    await pool.query("BEGIN");
    const orderResult = await pool.query(
      "INSERT INTO ORDERS (orderDescription, createdAt) VALUES ($1, $2) RETURNING id",
      [orderDescription, new Date()]
    );

    const orderId = orderResult.rows[0].id;

    for (const productId of products) {
      await pool.query(
        "INSERT INTO OrderProductMap (orderid, productid) VALUES ($1, $2)",
        [orderId, productId]
      );
    }

    await pool.query("COMMIT");
    res.status(201).json({ message: "Order created successfully", orderId });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/orders/:id", async (req, res) => {
  const { id } = req.params;
  const { orderDescription, products } = req.body;
  try {
    await pool.query("BEGIN");
    await pool.query("UPDATE ORDERS SET orderDescription = $1 WHERE Id = $2", [
      orderDescription,
      id,
    ]);

    await pool.query("DELETE FROM OrderProductMap WHERE orderId = $1", [id]);

    for (const productId of products) {
      await pool.query(
        "INSERT INTO OrderProductMap (orderId, productId) VALUES ($1, $2)",
        [id, productId]
      );
    }

    await pool.query("COMMIT");
    res.json({ message: "Order updated successfully" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/orders/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("BEGIN");
    await pool.query("DELETE FROM OrderProductMap WHERE orderId = $1", [id]);
    const result = await pool.query("DELETE FROM ORDERS WHERE Id = $1", [id]);
    await pool.query("COMMIT");

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Order not found" });
    } else {
      res.json({ message: "Order deleted successfully" });
    }
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
