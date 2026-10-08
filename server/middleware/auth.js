import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function extractAdminToken(req) {
  if (req.cookies && req.cookies.glazy_admin_token) {
    return req.cookies.glazy_admin_token;
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export function extractCustomerToken(req) {
  if (req.cookies && req.cookies.glazy_customer_token) {
    return req.cookies.glazy_customer_token;
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export function createAdminToken(admin) {
  return jwt.sign(
    {
      sub: String(admin.id),
      username: admin.username,
      email: admin.email,
      role: admin.role || 'owner',
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function createCustomerToken(customer) {
  return jwt.sign(
    {
      sub: String(customer.id),
      email: customer.email,
      role: 'customer',
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function makeRequireAuth(getAdminById) {
  return async function requireAuth(req, res, next) {
    const token = extractAdminToken(req);

    if (!token) {
      return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!['owner', 'staff', 'admin'].includes(decoded.role)) {
        return res.status(403).json({ message: 'Admin access required.' });
      }

      const admin = await getAdminById(decoded.sub);
      if (!admin) {
        return res.status(401).json({ message: 'Admin account not found or has been disabled.' });
      }

      req.admin = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role || 'staff',
      };

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
    }
  };
}

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const currentRole = req.admin.role === 'admin' ? 'owner' : req.admin.role;

    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({
        message: `Forbidden: This action requires [${allowedRoles.join(', ')}] permission. Your role is '${req.admin.role}'.`,
      });
    }

    next();
  };
}
