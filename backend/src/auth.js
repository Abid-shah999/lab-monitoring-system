import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const demoUsers = [
  { id: 1, name: "System Administrator", email: "admin@lab.local", role: "admin", passwordHash: bcrypt.hashSync("Password123!", 10) },
  { id: 2, name: "Lab Assistant", email: "assistant@lab.local", role: "assistant", passwordHash: bcrypt.hashSync("Password123!", 10) },
  { id: 3, name: "Research User", email: "user@lab.local", role: "user", passwordHash: bcrypt.hashSync("Password123!", 10) }
];

export function loginUser(email, password) {
  const user = demoUsers.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return null;
  const token = jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to access this resource" });
    }
    next();
  };
}
