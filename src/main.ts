import "@std/dotenv/load";
import { Bot, CommandContext, GrammyError, HearsContext, HttpError, InlineQueryResultBuilder, NextFunction } from "grammy";
import { Message } from "grammy_types";
import { WebLinkMap, CustomContext } from "./types.ts";
import { findMatchingMap, getExpeditorDebugString, getQueryDebugString } from "./utils.ts";
import { admin_actions } from "./admin_actions.ts";
import { ConfigurationManager } from "./config.ts";

enum COMMANDS {
	START = "start",
	PING = "ping",
	HELP = "help",
	LINK_CONVERT = "convert",
	LINK_EMBED = "embed",
}

const config_manager: ConfigurationManager = ConfigurationManager.Instance;
await config_manager.loadConfiguration();

/**
 * Get all the origins' hostnames.
 * @returns A strings array containing all the supported hostnames for detection
 */
function getOriginRegExes(): RegExp[] {
	return config_manager.Link_Mappings.filter((map: WebLinkMap): boolean => map.enabled) // Filter out maps that are not enabled
		.flatMap((map: WebLinkMap): RegExp[] => map.origins.map((origin): RegExp => new RegExp(`${origin.protocol}\/\/.*${origin.hostname.replaceAll(".", ".")}.*`, "gi"))); // Map and flatten the hostnames
}

/**
 * Process an incoming link conversion request.
 * @param ctx Command or Hears context.
 * @returns Completion promise.
 */
async function processConversionRequest(ctx: CommandContext<CustomContext> | HearsContext<CustomContext>): Promise<void> {
	// Handle mistakes where no link is given
	if (ctx.match.length < 1 && ctx.chat.type === "private") {
		await ctx.reply("Oop! No link was given with the command. 😅\nMaybe try again with a link following the command next time?\n<blockquote>Need help to use the command? Check « /help ».</blockquote>", {
			parse_mode: "HTML",
			reply_parameters: { message_id: ctx.msgId },
		});
		return;
	}

	// Check if link matches in map
	await ctx.react("🤔");
	const matchingMap: WebLinkMap | null = findMatchingMap(ctx.match.toString(), config_manager.Link_Mappings);
	if (matchingMap) {
		console.debug("Found the following match : " + matchingMap?.name);
		const linkConverted: URL = await matchingMap.parseLink(new URL(ctx.match.toString()));
		if (linkConverted.toString() === WebLinkMap.cleanLink(new URL(ctx.match.toString())).toString() && ctx.chat.type === "private")
			ctx.reply(`Hmm… That link already looks fine to me. 🤔`, { reply_parameters: { message_id: ctx.msgId } });
		else {
			await ctx.react("👀");
			if (ctx.chat.type === "private") await ctx.reply(`Oh I know that! 👀\nIt's a link from ${matchingMap?.name}!\nLemme convert that for you real quick… ✨`, { reply_parameters: { message_id: ctx.msgId } });
			const linkConvertedMessage: Message = await ctx.reply(linkConverted.toString(), { reply_parameters: { message_id: ctx.msgId }, link_preview_options: { show_above_text: true } });
			if (ctx.chat.type === "private")
				await ctx.reply("<i>There you go!</i> 😊\nHopefully @WebpageBot will create an embedded preview soon if it's not already there! ✨", {
					parse_mode: "HTML",
					reply_parameters: { message_id: linkConvertedMessage.message_id },
				});
		}
		return;
	} else if (ctx.chat.type === "private") {
		// Handle when link isn't known in map
		await ctx.react("🗿");
		await ctx.reply(
			`Sorry, I don't have an equivalent for that website. 😥\n<blockquote>If you happen to know one, feel free to submit a request through <a href="${config_manager.About.code_repo}/issues">an Issue on my code's repository</a>. 💛</blockquote>`,
			{
				parse_mode: "HTML",
				reply_parameters: { message_id: ctx.msgId },
				link_preview_options: { is_disabled: true },
			},
		);
	}
}

// https://grammy.dev/guide/context#transformative-context-flavors
const BOT = new Bot<CustomContext>(Deno.env.get("TG_PREVIEW_BOT_TOKEN") || "");
// await BOT.api.sendMessage(getUpdatesChatID(), "Bot is booting up… ⏳");
BOT.use((ctx: CustomContext, next: NextFunction) => {
	ctx.config = {
		botDeveloper: config_manager.About.owner,
		isDeveloper: ctx.from?.id === config_manager.About.owner,
	};
	next();
});
BOT.use(admin_actions);
BOT.api.setMyCommands([
	{ command: COMMANDS.START, description: "Start the bot." },
	{ command: COMMANDS.HELP, description: "Get a list of supported links." },
	{ command: COMMANDS.LINK_CONVERT, description: "Convert a link." },
]);

/**
 * Start command
 */
BOT.chatType("private").command(COMMANDS.START, function (ctx) {
	console.debug(`Incoming /${COMMANDS.START} by ${getExpeditorDebugString(ctx)}`);
	ctx.react("👀");
	let response: string = `Hi! I'm the ${BOT.botInfo.first_name}! 👋`;
	response += "\nA simple bot that serves the purpose of automatically embedding links!";
	response += "\n";
	if (config_manager.Features.link_recognition) response += "\nSend me a link I recognize and I'll respond with an embed-friendly + tracking-free version. ✨";
	if (BOT.botInfo.can_join_groups) response += "\nAlso, if you add me to a group, I'll do the same with links I can convert. 👀";
	response += `\n<blockquote>If you need more help, use the /${COMMANDS.HELP} command.</blockquote>`;
	response += "\n";
	response += `\nAnyway, I wish you a nice day! 🎶`;
	ctx.reply(response, { reply_parameters: { message_id: ctx.msgId }, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
});

/**
 * Healthcheck ping command
 */
BOT.chatType(["private", "group", "supergroup"]).command(COMMANDS.PING, function (ctx) {
	console.debug(`Incoming /${COMMANDS.PING} by ${getExpeditorDebugString(ctx)}`);
	ctx.react("⚡");
	ctx.reply("Pong! 🏓", { reply_parameters: { message_id: ctx.msgId } });
});

/**
 * Get help instructions
 */
BOT.chatType("private").command(COMMANDS.HELP, function (ctx) {
	console.debug(`Incoming /${COMMANDS.HELP} by ${getExpeditorDebugString(ctx)}`);
	let response: string = "Oh, you'll see. I'm a simple Synth!";
	response += `\nEither send me a link I recognize or use the /${COMMANDS.LINK_CONVERT} command to convert it into an embed-friendly one. ✨`;
	response += `\nYou may also use me directly while typing a new message in another chat. Simply start by mentioning me (${BOT.botInfo.username}) followed by a space! 😉`;
	response += "\n";
	response += "\n<blockquote>The links I recognize at the moment are :";
	for (const link_map of config_manager.Link_Mappings) if (link_map.enabled) response += `\n<b>${link_map.name}</b> : ${link_map.origins.map((origin: URL): string => origin.hostname)} → ${link_map.destination.hostname}`;
	response += "</blockquote>";
	response += "\n";
	response += `\nOf course, if there's a translation you'd like me to learn, feel free to suggest it as an issue <a href="${config_manager.About.code_repo}/issues/new">on GitHub</a>! 🌐`;
	ctx.reply(response, { reply_parameters: { message_id: ctx.msgId }, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
});

/**
 * Convert link
 */
BOT.command([COMMANDS.LINK_CONVERT, COMMANDS.LINK_EMBED], async function (ctx) {
	console.debug(`Incoming /${COMMANDS.LINK_CONVERT} by ${getExpeditorDebugString(ctx)} : ${getQueryDebugString(ctx)}`);
	await processConversionRequest(ctx);
});
BOT.hears(getOriginRegExes(), async function (ctx) {
	console.debug(`Recognized link by ${getExpeditorDebugString(ctx)} : ${getQueryDebugString(ctx)}`);
	await processConversionRequest(ctx);
});
BOT.inlineQuery(getOriginRegExes(), async function (ctx) {
	console.debug(`Incoming inline conversion query by ${getExpeditorDebugString(ctx)} : ${getQueryDebugString(ctx)}`);
	const link: string = ctx.match.toString();
	const map: WebLinkMap | null = findMatchingMap(ctx.match.toString(), config_manager.Link_Mappings);
	if (map != null) {
		const response = (await map.parseLink(new URL(link))).toString();
		ctx.answerInlineQuery([InlineQueryResultBuilder.article(map.name, `Convert ${map.name} link ✨`).text(response, { link_preview_options: { show_above_text: true } })]);
	} else ctx.answerInlineQuery([]);
});

/**
 * Lifecycle handling
 */
function getUpdatesChatID(): number {
	return config_manager.About.status_updates ? config_manager.About.status_updates.chat : config_manager.About.owner;
}
function stopBot(): void {
	console.info("Bot shutting down.");
	BOT.api.sendMessage(getUpdatesChatID(), "Bot shutting down! 💤", config_manager.About.status_updates?.topic ? { message_thread_id: config_manager.About.status_updates.topic } : {});
	BOT.stop();
}

BOT.catch((err): void => {
	const ctx = err.ctx;
	let error_message: string = `Error while handling update ${ctx.update.update_id} :`;
	const e = err.error;
	if (e instanceof GrammyError) {
		error_message += "Error in request : " + e.description;
	} else if (e instanceof HttpError) {
		error_message += "Could not contact Telegram : " + e;
	} else {
		error_message += "Unknown error : " + e;
	}
	console.error(error_message);
	BOT.api.sendMessage(getUpdatesChatID(), error_message, config_manager.About.status_updates?.topic ? { message_thread_id: config_manager.About.status_updates.topic } : {});
});
Deno.addSignalListener("SIGINT", (): void => stopBot());
if (Deno.build.os == "windows") Deno.addSignalListener("SIGBREAK", (): void => stopBot());
if (Deno.build.os != "windows") {
	Deno.addSignalListener("SIGQUIT", (): void => stopBot());
	Deno.addSignalListener("SIGTERM", (): void => stopBot());
}

console.info("Bot online!");
BOT.api.sendMessage(getUpdatesChatID(), "Bot online! 🎉", config_manager.About.status_updates?.topic ? { message_thread_id: config_manager.About.status_updates.topic } : {});
BOT.start();
