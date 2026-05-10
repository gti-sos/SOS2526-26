<script>
	const members = [
		{
			name: 'Moises Guillermo Godoy Nava',
			initials: 'MGN',
			// TODO MGN: pega aqui la URL publica del video (YouTube o similar).
			// Ejemplo: 'https://www.youtube.com/watch?v=XXXXXXXXXXX'
			videoUrl: ''
		},
		{
			name: 'Ricardo Fernandez Rodriguez-Navas',
			initials: 'RFR',
			videoUrl: 'https://drive.google.com/file/d/1yTiXwdUkstwKsdK0mu6k9_n00UNiXIWB/view?usp=sharing'
		},
		{
			name: 'Sergio Diaz Vazquez',
			initials: 'SDV',
			videoUrl: 'https://youtu.be/iXb__hMuZCc'
		}
	];

	function isValidUrl(url) {
		return typeof url === 'string' && url.trim().startsWith('http');
	}
</script>

<main class="about-page">
	<h1>About - Videos del equipo</h1>
	<p>En esta pagina se centralizan los enlaces a los videos individuales del entregable D03.</p>

	<section class="cards">
		{#each members as member}
			<article class="card">
				<h2>{member.initials} - {member.name}</h2>
				{#if isValidUrl(member.videoUrl)}
					<a class="btn" href={member.videoUrl} target="_blank" rel="noreferrer">
						Ver video de {member.initials}
					</a>
				{:else}
					<p class="pending">Pendiente: añade la URL del video en el codigo.</p>
				{/if}
			</article>
		{/each}
	</section>
</main>

<style>
	.about-page {
		max-width: 900px;
		margin: 0 auto;
		padding: 24px;
		font-family: sans-serif;
	}

	h1 {
		margin-bottom: 8px;
		color: #1f2937;
	}

	p {
		color: #4b5563;
	}

	.cards {
		margin-top: 20px;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 16px;
	}

	.card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		padding: 16px;
	}

	.card h2 {
		font-size: 1.05rem;
		margin: 0 0 12px 0;
		color: #111827;
	}

	.btn {
		display: inline-block;
		text-decoration: none;
		background: #2563eb;
		color: #fff;
		padding: 8px 12px;
		border-radius: 6px;
		font-weight: 600;
	}

	.pending {
		color: #b45309;
		font-weight: 600;
	}
</style>
