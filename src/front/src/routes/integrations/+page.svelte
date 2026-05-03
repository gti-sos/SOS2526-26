<script>
	const integrations = [
		{
			id: 'mgn',
			title: 'Integraciones MGN',
			description: 'Usos e integraciones de Moises Guillermo Godoy.'
		},
		{
			id: 'rfr',
			title: 'Integraciones RFR',
			description: 'Usos e integraciones de Ricardo Fernandez Rodriguez-Navas.'
		},
		{
			id: 'sdv',
			title: 'Integraciones SDV',
			description: 'Usos e integraciones de Sergio Diaz Vazquez.'
		}
	];
</script>

<main class="integrations-page">
	<h1>Centro de integraciones del grupo</h1>
	<p>Accede desde aqui a todas las vistas de integraciones y usos del equipo.</p>

	<section class="cards">
		{#each integrations as integration}
			<article class="card">
				<h2>{integration.title}</h2>
				<p>{integration.description}</p>
				<a href={`/integrations/${integration.id}`}>Ir a Integraciones</a>
			</article>
		{/each}
	</section>
</main>

<style>
	.integrations-page {
		max-width: 900px;
		margin: 0 auto;
		padding: 24px;
		font-family: sans-serif;
	}

	h1 {
		color: #1f2937;
		margin-bottom: 8px;
	}

	p {
		color: #4b5563;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 16px;
		margin-top: 20px;
	}

	.card {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		padding: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.card h2 {
		margin: 0 0 8px;
		font-size: 1.1rem;
		color: #111827;
	}

	.card p {
		margin: 0 0 12px;
		font-size: 0.95rem;
	}

	.card a {
		display: inline-block;
		background: #2563eb;
		color: #fff;
		text-decoration: none;
		padding: 8px 12px;
		border-radius: 6px;
		font-weight: 600;
	}

	.card a:hover {
		opacity: 0.9;
	}
</style>
