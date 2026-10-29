"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserCameraBackend,
  cameraError,
  type CameraPhase,
  type OriginalStill,
} from "@/lib/camera/browser-backend";
import type { ConstraintEntry } from "@/lib/camera/constraints";
import type { CapabilityMap, FacingMode } from "@/lib/camera/types";

export function useCamera(facing: FacingMode, enabled: boolean) {
  const backendRef = useRef<BrowserCameraBackend | null>(null);
  if (!backendRef.current) backendRef.current = new BrowserCameraBackend();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [message, setMessage] = useState("Opening the camera…");
  const [probe, setProbe] = useState<CapabilityMap | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generation, setGeneration] = useState(0);

  const start = useCallback(async (nextFacing: FacingMode) => {
    const backend = backendRef.current;
    if (!backend) return;
    setPhase("requesting");
    setMessage("Opening the camera…");
    try {
      const nextProbe = await backend.start(nextFacing);
      if (!nextProbe) return;
      const video = videoRef.current;
      const stream = backend.getStream();
      if (!video || !stream) throw new Error("The camera preview is not ready.");
      video.srcObject = stream;
      await video.play();
      setProbe(nextProbe);
      setConfirmed(nextProbe.trackSettings);
      setErrors({});
      setPhase("live");
      setMessage("Live");
      setGeneration((value) => value + 1);
    } catch (error) {
      const mapped = cameraError(error);
      setPhase(mapped.phase);
      setMessage(mapped.message);
      setProbe(null);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void start(facing);
    const backend = backendRef.current;
    return () => backend?.stop();
  }, [enabled, facing, start]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.hidden) backendRef.current?.stop();
      else void start(facing);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, facing, start]);

  const apply = useCallback(async (entries: ConstraintEntry[]) => {
    const backend = backendRef.current;
    if (!backend) return;
    try {
      const result = await backend.applyEntries(entries);
      setProbe(result.probe);
      setConfirmed(result.trackSettings);
      setErrors(result.errors);
    } catch {
      setMessage("A camera control could not be applied.");
    }
  }, []);

  const captureOriginal = useCallback(async (stillOptions: Record<string, unknown>) => {
    const video = videoRef.current;
    const backend = backendRef.current;
    if (!video || !backend) throw new Error("The camera is not live.");
    return backend.captureOriginal(video, stillOptions);
  }, []);

  const setPoint = useCallback(async (x: number, y: number, focusMode: string | null) => {
    const backend = backendRef.current;
    if (!backend) throw new Error("The camera is not live.");
    const settings = await backend.setPoint(x, y, focusMode);
    setConfirmed(settings);
    return settings;
  }, []);

  const startRecording = useCallback(async (canvas: HTMLCanvasElement, fps: number) => {
    const backend = backendRef.current;
    if (!backend) throw new Error("The camera is not live.");
    return backend.startRecording(canvas, fps);
  }, []);

  const stopRecording = useCallback(async () => {
    const backend = backendRef.current;
    if (!backend) throw new Error("Nothing is recording.");
    return backend.stopRecording();
  }, []);

  return {
    videoRef,
    phase,
    message,
    probe,
    confirmed,
    errors,
    generation,
    retry: () => start(facing),
    apply,
    captureOriginal,
    setPoint,
    startRecording,
    stopRecording,
  };
}

export type { OriginalStill };
