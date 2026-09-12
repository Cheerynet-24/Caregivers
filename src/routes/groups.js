const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Create group
router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        inviteCode: uuidv4().slice(0, 8),
        createdById: req.user.id,
        members: {
          create: { userId: req.user.id, role: 'admin' }
        }
      },
      include: { members: true }
    });
    res.status(201).json({ group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// My groups
router.get('/my', auth, async (req, res) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.user.id },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: { select: { id: true, username: true, displayName: true, avatar: true, isOnline: true } }
              }
            }
          }
        }
      }
    });
    const groups = memberships.map(m => ({ ...m.group, myRole: m.role }));
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get group by id
router.get('/:id', auth, async (req, res) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user.id } }
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatar: true, isOnline: true } }
          }
        }
      }
    });
    res.json({ group, myRole: member.role });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Add members (admin only)
router.post('/:id/members', auth, async (req, res) => {
  try {
    const { userIds } = req.body; // array
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array required' });
    }

    const me = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user.id } }
    });
    if (!me || me.role !== 'admin') {
      return res.status(403).json({ error: 'Only group admin can add members' });
    }

    const results = [];
    for (const uid of userIds) {
      try {
        const m = await prisma.groupMember.create({
          data: { groupId: req.params.id, userId: uid, role: 'member' }
        });
        results.push(m);
      } catch (e) {
        // already member, skip
      }
    }
    res.json({ message: 'Members added', added: results.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Join by invite code
router.post('/join/:inviteCode', auth, async (req, res) => {
  try {
    const group = await prisma.group.findUnique({
      where: { inviteCode: req.params.inviteCode }
    });
    if (!group) return res.status(404).json({ error: 'Invalid invite link' });

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: req.user.id } }
    });
    if (existing) return res.json({ message: 'Already a member', group });

    // For invite link: allow join (admin controls by regenerating code if needed)
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: req.user.id, role: 'member' }
    });
    res.json({ message: 'Joined group', group });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join' });
  }
});

// Remove member (admin)
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const me = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user.id } }
    });
    if (!me || me.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin' });
    }
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }
    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } }
    });
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Leave group
router.post('/:id/leave', auth, async (req, res) => {
  try {
    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user.id } }
    });
    res.json({ message: 'Left group' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Regenerate invite code (admin)
router.post('/:id/regenerate-invite', auth, async (req, res) => {
  try {
    const me = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user.id } }
    });
    if (!me || me.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin' });
    }
    const newCode = uuidv4().slice(0, 8);
    const group = await prisma.group.update({
      where: { id: req.params.id },
      data: { inviteCode: newCode }
    });
    res.json({ inviteCode: group.inviteCode });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
