<!-- Bảng phím của ArcadeFlightController (khớp DEFAULT_KEYMAP / DEFAULT_COMMAND_KEYS) -->
<script lang="ts">
	import type { Snippet } from 'svelte'

	/** `extra`: thêm dòng phím riêng của scene vào cuối bảng điều khiển */
	let { extra }: { extra?: Snippet } = $props()
</script>

<div class="help">
	<h3>Điều khiển</h3>
	<table>
		<tbody>
			<tr>
				<td><kbd>Chuột</kbd></td>
				<td>Mouse-aim: chỉ hướng, autopilot PID tự lái tới (bàn phím ghi đè khi bấm)</td>
			</tr>
			<tr>
				<td><kbd>W</kbd> <kbd>S</kbd></td>
				<td>Chúi mũi / kéo mũi lên</td>
			</tr>
			<tr>
				<td><kbd>A</kbd> <kbd>D</kbd></td>
				<td>Roll (Expert) · Rẽ (Standard)</td>
			</tr>
			<tr>
				<td><kbd>Q</kbd> <kbd>E</kbd></td>
				<td>Yaw (rudder)</td>
			</tr>
			<tr>
				<td><kbd>Shift</kbd></td>
				<td>Boost / afterburner (giữ)</td>
			</tr>
			<tr>
				<td><kbd>Space</kbd></td>
				<td>Phanh khí (giữ)</td>
			</tr>
			<tr>
				<td><kbd>[</kbd> <kbd>]</kbd> / lăn chuột</td>
				<td>Mức ga cruise</td>
			</tr>
			<tr>
				<td><kbd>M</kbd></td>
				<td>Đổi chế độ: Mouse-aim → Standard → Expert</td>
			</tr>
			<tr>
				<td><kbd>R</kbd></td>
				<td>Hồi sinh</td>
			</tr>
			{@render extra?.()}
		</tbody>
	</table>
	<h4>Maneuver đặc biệt</h4>
	<table>
		<tbody>
			<tr>
				<td><kbd>X</kbd></td>
				<td>
					<b>Split-S</b> — 1 phím: lật ngửa rồi kéo, quay 180° bổ nhào. Từ chối nếu không đủ độ cao.
				</td>
			</tr>
			<tr>
				<td><kbd>C</kbd></td>
				<td><b>Immelmann</b> — 1 phím: kéo nửa vòng lên rồi lật lại, quay 180° lấy độ cao.</td>
			</tr>
			<tr>
				<td><kbd>A</kbd><kbd>A</kbd> / <kbd>D</kbd><kbd>D</kbd></td>
				<td><b>Barrel roll</b> né tên lửa — double-tap.</td>
			</tr>
			<tr>
				<td><kbd>Shift</kbd>+<kbd>W/S</kbd>+<kbd>Space</kbd></td>
				<td><b>High-G turn</b> — giữ Shift+Space khi đang pitch: quay gắt hơn, mất tốc nhanh.</td>
			</tr>
			<tr>
				<td><kbd>Shift</kbd>+<kbd>Space</kbd> → <kbd>S</kbd></td>
				<td>
					<b>Post-Stall (PSM)</b> — tổ hợp: thả hết cần, bấm Shift+Space cùng lúc (≤120 ms) → "PSM
					READY" → kéo <kbd>S</kbd> = <b>Cobra</b>. Tiếp tục giữ <kbd>S</kbd> ≥ 0,7 s =
					<b>Kulbit</b>. <kbd>S</kbd>+<kbd>A/D</kbd> = <b>Herbst/J-turn</b>. Cần 250–450 km/h.
				</td>
			</tr>
			<tr>
				<td><kbd>V</kbd> → <kbd>S</kbd></td>
				<td>Cách 1 phím để vào PSM READY (thay cho tổ hợp).</td>
			</tr>
			<tr>
				<td><kbd>W</kbd> giữ mạnh</td>
				<td>Huỷ maneuver đang chạy.</td>
			</tr>
		</tbody>
	</table>
	<h4>Gamepad</h4>
	<p>
		Cần trái: pitch/roll · RT boost · LT phanh · LB/RB yaw (double-tap = barrel roll) · LT+RT với
		cần trung tính = PSM · A = PSM · X = Split-S · Y = Immelmann · Back = đổi chế độ · Start = hồi
		sinh.
	</p>
	<h4>Mẹo</h4>
	<p>
		Phanh xuống ~350 km/h ở độ cao > 500 m để thử Cobra/Kulbit. Tiêm kích có corner speed khoảng 650
		km/h, đó là lúc quay nhanh nhất. Thử đổi sang máy bay vận tải để cảm nhận quán tính lớn.
	</p>
</div>

<style>
	.help {
		font-size: 13px;
		line-height: 1.5;
	}
	h3 {
		margin: 4px 0 8px;
		font-size: 15px;
		font-weight: 700;
	}
	h4 {
		margin: 14px 0 4px;
		font-size: 13px;
		color: #7dffb0;
		font-weight: 600;
	}
	p {
		margin: 0;
		color: #b9cbc4;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	.help :global(td) {
		padding: 3px 4px;
		border-bottom: 1px solid rgb(255 255 255 / 0.06);
		vertical-align: top;
	}
	.help :global(td:first-child) {
		white-space: nowrap;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		color: #fff;
	}
	.help :global(kbd) {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		background: rgb(255 255 255 / 0.1);
		border-radius: 3px;
		padding: 0 4px;
	}
</style>
