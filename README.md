# تجزئة (cargo demo)

Frontend-only demo of a shipping system: purchase invoices from suppliers fill the stock, stock is cut into client orders that can mix products, and each order goes to a delivery man, who accepts or denies it from a separate login. The interface is Arabic and right-to-left. Data is generated on first load and stays in the browser's localStorage.

```
npm install
npm run dev
```

`npm run build` writes a static site to `dist/` that can be hosted from any folder.

Demo accounts, including a delivery man, are listed on the sign-in page. "Reset demo data" in the sidebar restores the original data.
