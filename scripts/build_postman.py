import json
def tests(*lines): return [{"listen":"test","script":{"type":"text/javascript","exec":list(lines)}}]
def req(name, method, path, body=None, token=None, t=None):
    r={"method":method,"header":[{"key":"Content-Type","value":"application/json"}],"url":"{{baseUrl}}"+path}
    if body is not None: r["body"]={"mode":"raw","raw":json.dumps(body,indent=2)}
    if token: r["auth"]={"type":"bearer","bearer":[{"key":"token","value":"{{%s}}"%token,"type":"string"}]}
    i={"name":name,"request":r}
    if t: i["event"]=t
    return i
def status(code, extra=()): return tests(f"pm.test('Status is {code}', () => pm.response.to.have.status({code}));", *extra)
def folder(name, items): return {"name":name,"item":items}
def login(name,email,pw,var): return req(name,"POST","/api/auth/login",{"email":email,"password":pw},t=status(200,[f"pm.collectionVariables.set('{var}', pm.response.json().data.accessToken);"]+([ "pm.collectionVariables.set('refreshToken', pm.response.json().data.refreshToken);" ] if var=='customerToken' else [])+([ "pm.collectionVariables.set('sellerId', pm.response.json().data.user.id);" ] if var=='sellerToken' else [])))
addr={"fullName":"Asha Customer","phone":"9876543210","line1":"12 MG Road","city":"Palwal","state":"Haryana","postalCode":"121102"}

col={"info":{"name":"E-Commerce & Inventory API","schema":"https://schema.getpostman.com/json/collection/v2.1.0/collection.json","description":"Run 'npm run seed' first, then run folders in order (use Collection Runner)."},
"variable":[{"key":"baseUrl","value":"http://localhost:5000"}],
"item":[
 folder("1. Auth (positive)",[
  login("Login admin","admin@shop.com","Admin@123","adminToken"),
  login("Login seller1","seller1@shop.com","Seller@123","sellerToken"),
  login("Login seller2","seller2@shop.com","Seller@123","seller2Token"),
  login("Login customer1","customer1@shop.com","Customer@123","customerToken"),
  req("Register new customer","POST","/api/auth/register",{"name":"Test User","email":"test{{$timestamp}}@shop.com","password":"Test@1234"},t=status(201,["pm.test('Returns tokens', () => pm.expect(pm.response.json().data.accessToken).to.be.a('string'));"])),
  req("Refresh token","POST","/api/auth/refresh",{"refreshToken":"{{refreshToken}}"},t=status(200,["pm.collectionVariables.set('customerToken', pm.response.json().data.accessToken);","pm.collectionVariables.set('refreshToken', pm.response.json().data.refreshToken);"])),
  req("Get my profile","GET","/api/users/me",token="customerToken",t=status(200)),
 ]),
 folder("2. Categories & Products (positive)",[
  req("List categories","GET","/api/categories",t=status(200,["const c = pm.response.json().data; pm.collectionVariables.set('categoryId', c[0]._id);"])),
  req("Admin creates category","POST","/api/categories",{"name":"Gadgets {{$timestamp}}","description":"Extra"},"adminToken",status(201)),
  req("Seller creates product","POST","/api/products",{"name":"Test Gadget","description":"Postman test product","price":1500,"category":"{{categoryId}}","stock":10,"lowStockThreshold":3},"sellerToken",status(201,["pm.collectionVariables.set('productId', pm.response.json().data._id);"])),
  req("Search / filter / sort / paginate","GET","/api/products?q=mouse&minPrice=100&maxPrice=5000&sort=price&page=1&limit=5",t=status(200,["pm.test('Has pagination', () => pm.expect(pm.response.json()).to.have.property('pages'));"])),
  req("Get product","GET","/api/products/{{productId}}",t=status(200)),
  req("Seller updates own product","PATCH","/api/products/{{productId}}",{"price":1600},"sellerToken",status(200)),
  req("Seller updates stock","PATCH","/api/products/{{productId}}/stock",{"stock":10},"sellerToken",status(200)),
 ]),
 folder("3. Cart & Orders (positive)",[
  req("Add to cart","POST","/api/cart/items",{"productId":"{{productId}}","quantity":2},"customerToken",status(201)),
  req("Update cart quantity","PATCH","/api/cart/items/{{productId}}",{"quantity":3},"customerToken",status(200,["pm.test('Total computed by server', () => pm.expect(pm.response.json().data.totalAmount).to.eql(4800));"])),
  req("View cart","GET","/api/cart",token="customerToken",t=status(200)),
  req("Place order","POST","/api/orders",{"shippingAddress":addr},"customerToken",status(201,["const o = pm.response.json().data; pm.collectionVariables.set('orderId', o._id);","pm.test('Payment marked simulated', () => pm.expect(o.payment.status).to.eql('SIMULATED_PAID'));","pm.test('Total verified', () => pm.expect(o.totalAmount).to.eql(4800));"])),
  req("Stock was reduced to 7","GET","/api/products/{{productId}}",t=status(200,["pm.test('Stock = 7', () => pm.expect(pm.response.json().data.stock).to.eql(7));"])),
  req("Customer order history","GET","/api/orders",token="customerToken",t=status(200)),
  req("Seller order queue (own items only)","GET","/api/orders?status=pending",token="sellerToken",t=status(200)),
  req("Seller confirms order","PATCH","/api/orders/{{orderId}}/status",{"status":"confirmed"},"sellerToken",status(200)),
  req("Seller ships order","PATCH","/api/orders/{{orderId}}/status",{"status":"shipped"},"sellerToken",status(200)),
  req("Place second order (to cancel)","POST","/api/cart/items",{"productId":"{{productId}}","quantity":1},"customerToken",status(201)),
  req("Place second order","POST","/api/orders",{"shippingAddress":addr},"customerToken",status(201,["pm.collectionVariables.set('orderId2', pm.response.json().data._id);"])),
  req("Customer cancels second order","PATCH","/api/orders/{{orderId2}}/status",{"status":"cancelled"},"customerToken",status(200)),
  req("Stock restored to 6","GET","/api/products/{{productId}}",t=status(200,["pm.test('Stock = 6', () => pm.expect(pm.response.json().data.stock).to.eql(6));"])),
 ]),
 folder("4. Reports",[
  req("Sales summary (admin)","GET","/api/reports/sales-summary",token="adminToken",t=status(200)),
  req("Best selling (seller)","GET","/api/reports/best-selling?limit=3",token="sellerToken",t=status(200)),
  req("Inventory summary (admin)","GET","/api/reports/inventory-summary",token="adminToken",t=status(200)),
  req("Low stock (seller)","GET","/api/reports/low-stock",token="sellerToken",t=status(200)),
 ]),
 folder("5. Negative / validation / authorization",[
  req("Validation failure: missing fields","POST","/api/products",{"name":"Bad"},"sellerToken",status(400,["pm.test('Field errors listed', () => pm.expect(pm.response.json().errors).to.be.an('array'));"])),
  req("Validation failure: weak password","POST","/api/auth/register",{"name":"X Y","email":"weak@shop.com","password":"123"},t=status(400)),
  req("Resource not found","GET","/api/products/000000000000000000000000",t=status(404)),
  req("No auth token","GET","/api/orders",t=status(401)),
  req("Invalid token","GET","/api/orders",token="badToken",t=status(401)),
  req("Wrong password","POST","/api/auth/login",{"email":"admin@shop.com","password":"wrong"},t=status(401)),
  req("Customer cannot create product (role)","POST","/api/products",{"name":"Hack","price":1,"category":"{{categoryId}}","stock":1},"customerToken",status(403)),
  req("Customer cannot view reports (role)","GET","/api/reports/sales-summary",token="customerToken",t=status(403)),
  req("Seller cannot manage users (role)","GET","/api/users",token="sellerToken",t=status(403)),
  req("Seller2 cannot edit seller1's product","PATCH","/api/products/{{productId}}",{"price":1},"seller2Token",status(403)),
  req("Duplicate registration","POST","/api/auth/register",{"name":"Dup","email":"customer1@shop.com","password":"Test@1234"},t=status(409)),
  req("Out-of-stock: add 50 to cart","POST","/api/cart/items",{"productId":"{{productId}}","quantity":50},"customerToken",status(409)),
  req("Place order with empty cart","POST","/api/orders",{"shippingAddress":addr},"customerToken",status(400)),
  req("Invalid status transition (shipped -> pending-ish confirmed)","PATCH","/api/orders/{{orderId}}/status",{"status":"confirmed"},"adminToken",status(400)),
  req("Customer cannot ship own order","PATCH","/api/orders/{{orderId}}/status",{"status":"delivered"},"customerToken",status(403)),
  req("Other seller cannot touch order","PATCH","/api/orders/{{orderId}}/status",{"status":"delivered"},"seller2Token",status(403)),
 ]),
]}
json.dump(col, open('postman/ecommerce-api.postman_collection.json','w'), indent=2)
print("collection written")
