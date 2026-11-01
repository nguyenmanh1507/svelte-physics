<script lang="ts">
	type Props = {
		id: string
		label: string
		display: string
		min: number
		max: number
		step: number
		value: number
	}

	let { id, label, display, min, max, step, value = $bindable() }: Props = $props()
</script>

<div class="ctl">
	<div class="row">
		<label for={id}>{label}</label>
		<output for={id}>{display}</output>
	</div>
	<input type="range" {id} {min} {max} {step} bind:value />
</div>

<style>
	.ctl {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}

	label {
		font-weight: 600;
	}

	output {
		font-variant-numeric: tabular-nums;
		color: var(--ink-dim);
		font-size: 12px;
	}

	input {
		width: 100%;
		accent-color: var(--sea);
		margin: 2px 0 0;
	}
</style>
