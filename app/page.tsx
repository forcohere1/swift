"use client";

import clsx from "clsx";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EnterIcon, LoadingIcon, MicOnIcon, MicOffIcon } from "@/lib/icons";
import { usePlayer } from "@/lib/usePlayer";
import { track } from "@vercel/analytics";
import { useMicVAD, utils } from "@ricky0123/vad-react";

type Message = {
	role: "user" | "assistant";
	content: string;
	latency?: number;
};

export default function Home() {
	const [input, setInput] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const player = usePlayer();

	const [isMicOn, setMicOn] = useState(true);

	const toggleMic = () => {
		if (isMicOn) {
			vad.pause(); // Assuming `vad` is your mic handler for VAD
		} else {
			vad.start();
		}
		setMicOn(!isMicOn);
	};

	const vad = useMicVAD({
		startOnLoad: true,
		onSpeechEnd: (audio) => {
			player.stop();
			const wav = utils.encodeWAV(audio);
			const blob = new Blob([wav], { type: "audio/wav" });
			submit(blob);
			const isFirefox = navigator.userAgent.includes("Firefox");
			if (isFirefox) vad.pause();
		},
		workletURL: "/vad.worklet.bundle.min.js",
		modelURL: "/silero_vad.onnx",
		positiveSpeechThreshold: 0.6,
		minSpeechFrames: 4,
		ortConfig(ort) {
			const isSafari = /^((?!chrome|android).)*safari/i.test(
				navigator.userAgent
			);

			ort.env.wasm = {
				wasmPaths: {
					"ort-wasm-simd-threaded.wasm":
						"/ort-wasm-simd-threaded.wasm",
					"ort-wasm-simd.wasm": "/ort-wasm-simd.wasm",
					"ort-wasm.wasm": "/ort-wasm.wasm",
					"ort-wasm-threaded.wasm": "/ort-wasm-threaded.wasm",
				},
				numThreads: isSafari ? 1 : 4,
			};
		},
	});

	useEffect(() => {
		function keyDown(e: KeyboardEvent) {
			if (e.key === "Enter") return inputRef.current?.focus();
			if (e.key === "Escape") return setInput("");
		}

		window.addEventListener("keydown", keyDown);
		return () => window.removeEventListener("keydown", keyDown);
	});

	const [messages, submit, isPending] = useActionState<
		Array<Message>,
		string | Blob
	>(async (prevMessages, data) => {
		const formData = new FormData();

		if (typeof data === "string") {
			formData.append("input", data);
			track("Text input");
		} else {
			formData.append("input", data, "audio.wav");
			track("Speech input");
		}

		for (const message of prevMessages) {
			formData.append("message", JSON.stringify(message));
		}

		const submittedAt = Date.now();

		const response = await fetch("/api", {
			method: "POST",
			body: formData,
		});

		const transcript = decodeURIComponent(
			response.headers.get("X-Transcript") || ""
		);
		const text = decodeURIComponent(
			response.headers.get("X-Response") || ""
		);

		if (!response.ok || !transcript || !text || !response.body) {
			if (response.status === 429) {
				toast.error("Too many requests. Please try again later.");
			} else {
				toast.error((await response.text()) || "An error occurred.");
			}

			return prevMessages;
		}

		const latency = Date.now() - submittedAt;
		player.play(response.body, () => {
			const isFirefox = navigator.userAgent.includes("Firefox");
			if (isFirefox) vad.start();
		});

		return [
			...prevMessages,
			{
				role: "user",
				content: transcript,
			},
			{
				role: "assistant",
				content: text,
				latency,
			},
		];
	}, []);

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		submit(input);
		setInput("");
	}

	return (
		<>
		<div className="flex flex-col justify-between w-screen min-h-screen bg-gray-50 dark:bg-gray-900">
			<div className="w-full max-w-5xl mx-auto h-full flex flex-col">
			<button
				onClick={toggleMic}
				className="fixed bottom-10 right-10 p-4 bg-gray-200 dark:bg-gray-700 rounded-full shadow-lg"
				aria-label="Toggle Microphone"
			>
				{isMicOn ? <MicOnIcon /> : <MicOffIcon />}
			</button>
			{/* Chat Box Container */}
			<div className="flex flex-col bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-4 h-[80vh] relative">
				{/* Scrollable Messages */}
				<div className="overflow-y-auto flex-grow p-4 mb-2">
				{messages.length > 0 ? (
					messages.map((message, index) => (
					<div
						key={index}
						className={clsx(
						"p-2 mb-2 rounded-lg",
						{
							"bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 self-end":
							message.role === "user",
							"bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 self-start":
							message.role === "assistant",
						}
						)}
					>
						<p>{message.content}</p>
						{message.latency && (
						<span className="text-xs text-gray-500 dark:text-gray-400">
							{message.latency}ms
						</span>
						)}
					</div>
					))
				) : (
					<p className="text-gray-500 dark:text-gray-400">
					Start a conversation by typing or speaking.
					</p>
				)}
				</div>
			</div>
			{/* Input Field - Fixed */}
			<form
				onSubmit={handleFormSubmit}
				className="w-full max-w-5xl mx-auto flex items-center bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-full shadow-md px-4 py-2 mt-2"
			>
				<input
				type="text"
				className="bg-transparent focus:outline-none p-2 w-full text-black dark:text-white"
				placeholder="Type your message here..."
				value={input}
				onChange={(e) => setInput(e.target.value)}
				ref={inputRef}
				/>
				<button
				type="submit"
				className="text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
				disabled={isPending}
				aria-label="Submit"
				>
				{isPending ? <LoadingIcon /> : <EnterIcon />}
				</button>
			</form>
			</div>

			{/* Visual Speech Detection */}
			<div
			className={clsx(
				"absolute bottom-10 right-10 w-40 h-40 blur-lg rounded-full bg-gradient-to-b from-red-100 to-red-300 dark:from-red-600 dark:to-red-800 transition ease-in-out",
				{
				"opacity-0": vad.loading || vad.errored,
				"opacity-30": !vad.loading && !vad.errored && !vad.userSpeaking,
				"opacity-100 scale-110": vad.userSpeaking,
				}
			)}
			/>
		</div>
		</>
	);
}

function A(props: any) {
	return (
		<a
			{...props}
			className="text-neutral-500 dark:text-neutral-500 hover:underline font-medium"
		/>
	);
}
