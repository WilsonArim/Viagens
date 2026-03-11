"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
};

const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.4,
        },
    },
};

const staggerItem: Variants = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0 },
};

export function AnimatedEyebrow({ children }: { children: ReactNode }) {
    return (
        <motion.p
            className="eyebrow"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
        >
            {children}
        </motion.p>
    );
}

export function AnimatedTitle({ children }: { children: ReactNode }) {
    return (
        <motion.h1
            className="landing-title"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.7, delay: 0.1 }}
        >
            {children}
        </motion.h1>
    );
}

export function AnimatedSubtitle({ children }: { children: ReactNode }) {
    return (
        <motion.p
            className="landing-subtitle"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.7, delay: 0.2 }}
        >
            {children}
        </motion.p>
    );
}

export function AnimatedCTA({ children }: { children: ReactNode }) {
    return (
        <motion.div
            className="cta-row"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.3 }}
        >
            {children}
        </motion.div>
    );
}

export function AnimatedFeatureGrid({ children }: { children: ReactNode }) {
    return (
        <motion.div
            id="modules"
            className="feature-grid"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
        >
            {children}
        </motion.div>
    );
}

export function AnimatedFeatureCard({ children }: { children: ReactNode }) {
    return (
        <motion.article className="feature-card" variants={staggerItem}>
            {children}
        </motion.article>
    );
}
