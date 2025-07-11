
const db = require('../db');

exports.getAdminProfile = async (req, res) => {
    const adminId = req.session.user.id;
    const query = `SELECT * FROM users WHERE userId = ? AND userRole = 'admin'`;
    try {
        const [results] = await db.query(query, [adminId]);
        if (results.length === 0) return res.status(404).send('Admin profile not found.');
        res.render('adminProfile', { admin: results[0] });
    } catch (err) {
        console.error('Error fetching admin profile:', err);
        res.status(500).send('Error fetching admin profile.');
    }
};

exports.updateProfile = async (req, res) => {
    const userId = req.session.user.id;
    const { username, email, password } = req.body;
    if (!userId) return res.status(401).send('You need to log in first');

    try {
        const [results] = await db.query(
            'UPDATE users SET username = ?, userEmail = ?, userPassword = ? WHERE userId = ?',
            [username, email, password, userId]
        );
        if (results.affectedRows === 0) return res.status(404).send('User not found or no changes made');
        res.redirect('/admin/profile');
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).send('Error updating profile');
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM users');
        res.render('manageUsers', { users: results });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).send('Error fetching users');
    }
};

exports.getAdminClothes = async (req, res) => {
    const query = `SELECT clothingId AS id, clothingName AS name, clothingDescription AS description, clothingPrice AS price, clothingStock AS stock, clothingImage AS image FROM Clothes`;
    try {
        const [results] = await db.query(query);
        const clothes = results.map(item => ({
            ...item,
            price: item.price !== null ? Number(item.price) : 0.00,
            stock: item.stock || 0,
            name: item.name || 'Unnamed Product',
            description: item.description || 'No Description',
            image: item.image || null,
        }));
        res.render('adminClothes', { clothes });
    } catch (err) {
        console.error('Error fetching clothes:', err);
        res.status(500).send('Error fetching clothes.');
    }
};

exports.getAdminVinyls = async (req, res) => {
    const query = `SELECT vinylId AS id, vinylName AS name, vinylDescription AS description, vinylPrice AS price, vinylStock AS stock, vinylImage AS image FROM Vinyls`;
    try {
        const [results] = await db.query(query);
        const vinyls = results.map(item => ({
            ...item,
            price: item.price !== null ? parseFloat(item.price) : 0.00,
            stock: item.stock || 0,
            name: item.name || 'Unnamed Product',
            description: item.description || 'No Description',
            image: item.image || null,
        }));
        res.render('adminVinyls', { vinyls });
    } catch (err) {
        console.error('Error fetching vinyls:', err);
        res.status(500).send('Error fetching vinyls.');
    }
};

exports.getWhatsNew = async (req, res) => {
  const productQuery = 'SELECT id, name, description, price, category, image, createdAt FROM WhatsNew';
  const rsvpQuery = `
    SELECT r.productId, u.username
    FROM ProductRSVPs r
    JOIN users u ON r.userId = u.userId
  `;

  try {
    const [products] = await db.query(productQuery);
    const [rsvps] = await db.query(rsvpQuery);

    // Group RSVPs by productId
    const rsvpMap = {};
    rsvps.forEach(rsvp => {
      if (!rsvpMap[rsvp.productId]) rsvpMap[rsvp.productId] = [];
      rsvpMap[rsvp.productId].push(rsvp.username);
    });

    const formatted = products.map(p => ({
      ...p,
      rsvps: rsvpMap[p.id] || []
    }));

    res.render('adminWhatsNew', { products: formatted });
  } catch (err) {
    console.error("Error fetching What's New products or RSVPs:", err);
    res.status(500).send("Error fetching data.");
  }
};


exports.renderEditProductPage = async (req, res) => {
    const { id, type } = req.params;
    let productQuery;

    if (type === 'Clothes') {
        productQuery = 'SELECT * FROM Clothes WHERE clothingId = ?';
    } else if (type === 'Vinyls') {
        productQuery = 'SELECT * FROM Vinyls WHERE vinylId = ?';
    } else if (type === 'WhatsNew') {
        productQuery = 'SELECT * FROM WhatsNew WHERE id = ?';
    } else {
        return res.status(400).send('Invalid product type.');
    }

    try {
        const [productResults] = await db.query(productQuery, [id]);
        if (productResults.length === 0) return res.status(404).send('Product not found.');

        let item = productResults[0];

        if (type === 'Clothes') {
            item = {
                id: item.clothingId,
                name: item.clothingName,
                description: item.clothingDescription,
                price: item.clothingPrice,
                stock: item.clothingStock,
                image: item.clothingImage,
                categoryId: item.categoryId,
                productfilter: item.productfilter
            };
        } else if (type === 'Vinyls') {
            item = {
                id: item.vinylId,
                name: item.vinylName,
                description: item.vinylDescription,
                price: item.vinylPrice,
                stock: item.vinylStock,
                image: item.vinylImage,
                categoryId: item.categoryId,
                productfilter: item.productfilter
            };
        }

        const [categoryResults] = await db.query('SELECT * FROM categories');
        const [filterResults] = await db.query('SELECT filterType FROM productfilter');
        const filters = filterResults.map(row => row.filterType);

        // ✅ Render page with all needed data
        res.render('editProduct', {
            item,
            type,
            categories: categoryResults,
            filters
        });
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).send('Error fetching product.');
    }
};


exports.editProduct = async (req, res) => {
    const { id, type } = req.params;
    const { name, description, price, stock, categoryId, productfilter } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!categoryId || !productfilter) return res.status(400).send('Category and Product Filter are required.');

    let query, values;

    if (type === 'Clothes') {
        if (image) {
            query = `UPDATE Clothes SET clothingName = ?, clothingDescription = ?, clothingPrice = ?, clothingStock = ?, categoryId = ?, productfilter = ?, clothingImage = ? WHERE clothingId = ?`;
            values = [name, description, price, stock, categoryId, productfilter, image, id];
        } else {
            query = `UPDATE Clothes SET clothingName = ?, clothingDescription = ?, clothingPrice = ?, clothingStock = ?, categoryId = ?, productfilter = ? WHERE clothingId = ?`;
            values = [name, description, price, stock, categoryId, productfilter, id];
        }
    } else if (type === 'Vinyls') {
        if (image) {
            query = `UPDATE Vinyls SET vinylName = ?, vinylDescription = ?, vinylPrice = ?, vinylStock = ?, categoryId = ?, productfilter = ?, vinylImage = ? WHERE vinylId = ?`;
            values = [name, description, price, stock, categoryId, productfilter, image, id];
        } else {
            query = `UPDATE Vinyls SET vinylName = ?, vinylDescription = ?, vinylPrice = ?, vinylStock = ?, categoryId = ?, productfilter = ? WHERE vinylId = ?`;
            values = [name, description, price, stock, categoryId, productfilter, id];
        }
    } else {
        return res.status(400).send('Invalid product type.');
    }

    try {
        await db.query(query, values);
        res.redirect(`/admin/manage${type.toLowerCase()}`);
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).send('Error updating product.');
    }
};

exports.renderAddNewProductPage = async (req, res) => {
    const { type } = req.params;
    try {
        const [categoryResults] = await db.query('SELECT * FROM categories');
        const [filterResults] = await db.query('SELECT filterType FROM productfilter');
        const filters = filterResults.map(row => row.filterType);
        res.render('addNewProduct', { type, categories: categoryResults, filters });
    } catch (err) {
        console.error('Error fetching categories or filters:', err);
        res.status(500).send('Error fetching form data.');
    }
};

exports.addNewProduct = async (req, res) => {
    const { type } = req.params;
    const { name, description, price, stock, categoryId, productfilter } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!image) return res.status(400).send('Image is required.');

    let query, values;

    if (type === 'Clothes') {
        query = `INSERT INTO Clothes (clothingName, clothingDescription, clothingImage, clothingPrice, clothingStock, categoryId, productfilter) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        values = [name, description, image, price || 0, stock || 0, categoryId, productfilter];
    } else if (type === 'Vinyls') {
        query = `INSERT INTO Vinyls (vinylName, vinylDescription, vinylImage, vinylPrice, vinylStock, categoryId, productfilter) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        values = [name, description, image, price || 0, stock || 0, categoryId, productfilter];
    } else if (type === 'WhatsNew') {
        query = `INSERT INTO WhatsNew (name, description, price, category, image) VALUES (?, ?, ?, ?, ?)`;
        values = [name, description, price || 0, categoryId, image];
    } else {
        return res.status(400).send('Invalid product type.');
    }

    try {
        await db.query(query, values);
        res.redirect(`/admin/manage${type.toLowerCase()}`);
    } catch (err) {
        console.error('Error adding new product:', err);
        res.status(500).send('Error adding new product.');
    }
};

exports.deleteProduct = async (req, res) => {
    const { id, type } = req.params;
    let query;

    if (type === 'Clothes') {
        query = 'DELETE FROM Clothes WHERE clothingId = ?';
    } else if (type === 'Vinyls') {
        query = 'DELETE FROM Vinyls WHERE vinylId = ?';
    } else if (type === 'WhatsNew') {
        query = 'DELETE FROM WhatsNew WHERE id = ?';
    } else {
        return res.status(400).send('Invalid product type.');
    }

    try {
        await db.query(query, [id]);
        res.redirect(`/admin/manage${type.toLowerCase()}`);
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).send('Error deleting product');
    }
};


exports.getAllTransactions = async (req, res) => {
    const transactionsQuery = `SELECT transactionId, userId, userName, userEmail, transactionDate, itemsPurchased, totalAmount FROM transactions`;
    const reviewsQuery = 'SELECT username, comment, createdAt FROM reviews';

    try {
        const [transactionResults] = await db.query(transactionsQuery);
        const transactions = transactionResults.map(transaction => ({
            ...transaction,
            itemsPurchased: (() => {
                try {
                    return JSON.parse(transaction.itemsPurchased);
                } catch {
                    return [];
                }
            })(),
            totalAmount: Number(transaction.totalAmount) || 0
        }));

        const [reviewResults] = await db.query(reviewsQuery);
        res.render('viewTransactions', { transactions, reviews: reviewResults });
    } catch (err) {
        console.error('Error fetching transactions or reviews:', err);
        res.status(500).send('Error fetching transactions or reviews.');
    }
};

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Product Count
    const [productRows] = await db.query(`
      SELECT 'Clothes' AS type, COUNT(*) AS count FROM clothes
      UNION
      SELECT 'Vinyls', COUNT(*) FROM vinyls
    `);

    // 2. Orders per month
    const [orderRows] = await db.query(`
      SELECT 
        DATE_FORMAT(transactionDate, '%b') AS month,
        COUNT(*) AS orderCount
      FROM transactions
      GROUP BY month
      ORDER BY STR_TO_DATE(month, '%b')
    `);

    // 3. Sales parsing from itemsPurchased JSON
    const [salesRaw] = await db.query(`
      SELECT transactionDate, itemsPurchased FROM transactions
    `);

    const salesData = {};
    salesRaw.forEach(({ transactionDate, itemsPurchased }) => {
      const month = new Date(transactionDate).toLocaleString('default', { month: 'short' });
      const items = JSON.parse(itemsPurchased);
      if (!salesData[month]) salesData[month] = { Clothes: 0, Vinyls: 0 };

      items.forEach(item => {
        if (item.itemType === 'Clothes') salesData[month].Clothes += parseFloat(item.itemPrice);
        if (item.itemType === 'Vinyls') salesData[month].Vinyls += parseFloat(item.itemPrice);
      });
    });

    res.render('admin', {
      productStats: productRows,
      orderStats: orderRows,
      salesStats: salesData
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).send('Error loading dashboard data');
  }
};
