import { Request, Response } from 'express';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { encrypt } from '../config/encryption';
import { getOAuth2Client } from '../services/driveService';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-signing-key-change-me-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Redirects the user to Google OAuth consent page.
 */
export function redirectToGoogle(req: Request, res: Response) {
  const oauth2Client = getOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive.file',
    ],
    prompt: 'consent',
  });
  
  res.redirect(authUrl);
}

/**
 * Handles Google OAuth callback, exchanges code for credentials,
 * upserts User, encrypts/stores refresh token, and signs/issues App JWT.
 */
export async function handleGoogleCallback(req: Request, res: Response) {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).json({ error: 'Auth code parameter is missing' });
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoResponse = await oauth2.userinfo.get();
    const profile = userInfoResponse.data;

    if (!profile.id || !profile.email) {
      return res.status(400).json({ error: 'Unable to retrieve profile from Google' });
    }

    let encryptedRefreshToken: string | null = null;
    if (tokens.refresh_token) {
      encryptedRefreshToken = encrypt(tokens.refresh_token);
    }

    const user = await prisma.user.upsert({
      where: { googleId: profile.id },
      update: {
        email: profile.email,
        name: profile.name || 'Anonymous User',
        avatarUrl: profile.picture || null,
        ...(encryptedRefreshToken ? { refreshTokenEncrypted: encryptedRefreshToken } : {}),
      },
      create: {
        googleId: profile.id,
        email: profile.email,
        name: profile.name || 'Anonymous User',
        avatarUrl: profile.picture || null,
        refreshTokenEncrypted: encryptedRefreshToken,
        theme: 'system',
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${FRONTEND_URL}/auth-success?token=${token}`);
  } catch (error: any) {
    console.error('Google OAuth callback failure:', error);
    res.status(500).json({ error: `OAuth validation failed: ${error.message}` });
  }
}

/**
 * Returns current authenticated user metadata.
 */
export async function getMe(req: Request, res: Response) {
  const authReq = req as any;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        theme: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Updates the theme preferences of the authenticated user.
 */
export async function updateTheme(req: Request, res: Response) {
  const authReq = req as any;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { theme } = req.body;
  if (!theme || !['light', 'dark', 'system'].includes(theme)) {
    return res.status(400).json({ error: 'Theme must be one of: light, dark, system' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: authReq.user.id },
      data: { theme },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        theme: true,
        createdAt: true,
      },
    });

    return res.json(user);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Log out user by clearing cookie.
 */
export function logout(req: Request, res: Response) {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully' });
}
